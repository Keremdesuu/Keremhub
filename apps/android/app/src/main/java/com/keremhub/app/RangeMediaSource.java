package com.keremhub.app;

import android.media.MediaDataSource;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.regex.*;

/** Bounded random-access reads: MP4 metadata at the end never requires a full download. */
final class RangeMediaSource extends MediaDataSource {
    private static final int BLOCK = 256 * 1024;
    private final String address;
    private final LinkedHashMap<Long, byte[]> cache = new LinkedHashMap<>(8, .75f, true);
    private volatile boolean closed;
    private volatile HttpURLConnection active;
    private long size = -1;

    RangeMediaSource(String address) throws IOException {
        this.address = address;
        block(0);
    }

    private byte[] block(long start) throws IOException {
        if (closed) throw new IOException("Stream closed");
        byte[] cached = cache.get(start);
        if (cached != null) return cached;
        HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
        active = c;
        try {
            if (closed) throw new IOException("Stream closed");
            c.setConnectTimeout(12000);
            c.setReadTimeout(15000);
            c.setRequestProperty("Range", "bytes=" + start + "-" + (start + BLOCK - 1));
            c.setRequestProperty("Accept-Encoding", "identity");
            c.setRequestProperty("User-Agent", "Keremhub-Android/1.0");
            int status = c.getResponseCode();
            Matcher range = Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)").matcher(
                    Objects.toString(c.getHeaderField("Content-Range"), ""));
            if (status != 206 || !range.matches() || Long.parseLong(range.group(1)) != start)
                throw new IOException("Server does not support byte ranges (HTTP " + status + ")");
            long total = Long.parseLong(range.group(3));
            if (total <= 0 || (size >= 0 && size != total)) throw new IOException("Stream size changed");
            size = total;
            int length = (int) Math.min(BLOCK, size - start);
            if (length <= 0 || Long.parseLong(range.group(2)) != start + length - 1)
                throw new IOException("Invalid byte range");
            byte[] bytes = new byte[length];
            try (DataInputStream input = new DataInputStream(c.getInputStream())) { input.readFully(bytes); }
            if (closed) throw new IOException("Stream closed");
            cache.put(start, bytes);
            if (cache.size() > 8) cache.remove(cache.keySet().iterator().next());
            return bytes;
        } finally { c.disconnect(); if (active == c) active = null; }
    }

    @Override public synchronized int readAt(long position, byte[] buffer, int offset, int count) throws IOException {
        if (closed) throw new IOException("Stream closed");
        if (position < 0 || offset < 0 || count < 0 || count > buffer.length - offset) throw new IOException("Invalid read");
        if (count == 0) return 0;
        if (position >= size) return -1;
        long start = position / BLOCK * BLOCK;
        byte[] bytes = block(start);
        int from = (int) (position - start);
        int length = Math.min(count, bytes.length - from);
        System.arraycopy(bytes, from, buffer, offset, length);
        return length;
    }
    @Override public long getSize() { return size; }
    @Override public void close() {
        closed = true;
        HttpURLConnection c = active;
        if (c != null) c.disconnect();
    }
}

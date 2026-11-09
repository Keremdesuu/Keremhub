"use strict";
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const TEXT_CODECS = new Set([
  "subrip",
  "srt",
  "ass",
  "ssa",
  "mov_text",
  "webvtt",
  "text",
]);
function createSubtitleService(upstream, run = promisify(execFile)) {
  const metadata = new Map(),
    captions = new Map();
  let queue = Promise.resolve(),
    pending = 0;
  function limited(job) {
    if (pending >= 8)
      return Promise.reject(
        Error("Altyazı işlemleri meşgul. Biraz sonra tekrar dene."),
      );
    pending++;
    const task = queue.then(job);
    queue = task.catch(() => {});
    return task.finally(() => pending--);
  }
  function remember(map, key, job, limit) {
    const cached = map.get(key);
    if (cached && Date.now() - cached.at < 600000) return cached.promise;
    const promise = limited(job).catch((error) => {
      map.delete(key);
      throw error;
    });
    map.delete(key);
    map.set(key, { at: Date.now(), promise });
    while (map.size > limit) map.delete(map.keys().next().value);
    return promise;
  }
  const source = (id) => new URL("api/stream/" + id, upstream).href;
  async function tracks(id) {
    if (!/^[1-9]\d*$/.test(String(id))) throw Error("Geçersiz video");
    return remember(
      metadata,
      id,
      async () => {
        const { stdout } = await run(
          "ffprobe",
          [
            "-v",
            "error",
            "-rw_timeout",
            "15000000",
            "-select_streams",
            "s",
            "-show_entries",
            "stream=index,codec_name:stream_tags=language,title:stream_disposition=forced",
            "-of",
            "json",
            source(id),
          ],
          { timeout: 25000, maxBuffer: 1024 * 1024 },
        );
        return (JSON.parse(stdout).streams || [])
          .filter((t) => TEXT_CODECS.has(t.codec_name))
          .map((t) => ({
            type: "TEXT",
            index: t.index,
            source: "server",
            extra_info: JSON.stringify({
              track_lang: t.tags?.language || "",
              title: t.tags?.title || "",
              forced: !!t.disposition?.forced,
              codec: t.codec_name,
            }),
          }));
      },
      64,
    );
  }
  async function text(id, index) {
    if (!/^\d+$/.test(String(index))) throw Error("Geçersiz altyazı");
    const available = await tracks(id);
    if (!available.some((t) => t.index === Number(index)))
      throw Error("Desteklenen altyazı bulunamadı");
    return remember(
      captions,
      id + ":" + index,
      async () => {
        const { stdout } = await run(
          "ffmpeg",
          [
            "-nostdin",
            "-v",
            "error",
            "-rw_timeout",
            "15000000",
            "-i",
            source(id),
            "-map",
            "0:" + index,
            "-f",
            "webvtt",
            "pipe:1",
          ],
          { timeout: 90000, maxBuffer: 8 * 1024 * 1024 },
        );
        if (!stdout.startsWith("WEBVTT"))
          throw Error("Altyazı dönüştürülemedi");
        return stdout;
      },
      16,
    );
  }
  return { tracks, text };
}
module.exports = { createSubtitleService };

package com.keremhub.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Fragment;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.DocumentsContract;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.ImageSpan;
import android.text.style.URLSpan;
import android.view.Gravity;
import android.view.View;
import android.webkit.MimeTypeMap;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Native Drive client. This module depends only on the IMPLEMENTATION.md activity contract. */
public final class DriveScreen {
    private static final String API = "/drive/api";
    private static final Locale TR = Locale.forLanguageTag("tr-TR");
    private static final ExecutorService IO = Executors.newFixedThreadPool(3);
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final String[] MODES = {"Dosyalarım", "Yıldızlı", "Son kullanılan", "Çöp kutusu"};
    private static final String[] MODE_KEYS = {"files", "starred", "recent", "trash"};
    private static final String[] TYPES = {"Tümü", "Klasör", "Görsel", "Video", "Ses", "PDF", "Word", "Excel", "Metin", "Diğer"};
    private static final String[] TYPE_KEYS = {"all", "folder", "image", "video", "audio", "pdf", "docx", "xlsx", "text", "file"};
    private static final String[] SORTS = {"Ad · A–Z", "Ad · Z–A", "Son değiştirilme", "İlk değiştirilme", "Boyut · büyük", "Boyut · küçük", "Son oluşturulma"};
    private final MainActivity a;
    private final SharedPreferences prefs;
    private final Session session;
    private String parent, query = "";
    private int mode, type, sort;
    private boolean grid, dark, busy;
    private LinearLayout body, list, selection, statsBox, status;
    private TextView workspaceTitle, itemCount, fileCounts, storageSummary;
    private EditText searchField;
    private JSONObject storage = new JSONObject();
    private boolean loading;
    private final List<JSONObject> items = new ArrayList<>();
    private final LinkedHashSet<String> selected = new LinkedHashSet<>();
    private JSONArray crumbs = new JSONArray();
    private long loadId;
    private boolean wide;
    private final List<android.app.Dialog> dialogs = new ArrayList<>();
    private Runnable searchPending;
    private Transfer activeTransfer;
    private static final class Session {
        final List<JSONObject> clipboard = new ArrayList<>();
        boolean copy;
    }
    private static final class DragItems {
        final List<JSONObject> items;
        DragItems(List<JSONObject> items) { this.items = items; }
    }

    public static void show(MainActivity a) { new DriveScreen(a, new Session()).render(); }
    private DriveScreen(MainActivity activity, Session session) {
        a = activity;
        this.session = session;
        prefs = a.getSharedPreferences("kerem-drive", Activity.MODE_PRIVATE);
        dark = prefs.getBoolean("dark", false);
        grid = prefs.getBoolean("grid", true);
        sort = prefs.getInt("sort", 0);
        if (sort < 0 || sort >= SORTS.length) sort = 0;
    }
    private boolean trash() { return mode == 3; }
    private boolean alive(LinearLayout page) { return body == page && page.isAttachedToWindow() && !a.isFinishing() && !a.isDestroyed(); }
    private void theme() {
        a.theme(Color.parseColor(dark ? "#14181f" : "#f6f7f9"), Color.parseColor(dark ? "#1b212a" : "#ffffff"),
                Color.parseColor(dark ? "#e0e6ef" : "#29313d"), Color.parseColor(dark ? "#9ba9bb" : "#7c8696"),
                Color.parseColor(dark ? "#8ca7ff" : "#4269db"));
    }
    private void render() {
        ++loadId;
        theme();
        wide = a.getResources().getConfiguration().screenWidthDp > 520;
        body = a.page("keremdrive.", "");
        a.remember(this::render);
        bindLifecycle(body, this::render);
        // A single document scroller preserves the site's minimum workspace height in landscape.
        LinearLayout header = Ui.fixedHeader(a); header.setBackgroundColor(a.surface);
        header.setPadding(a.dp(wide ? 24 : 15), a.dp(10), a.dp(wide ? 24 : 15), a.dp(10));
        LinearLayout top = a.row(); header.addView(top, new LinearLayout.LayoutParams(-1, a.dp(44)));
        View cloud = glyph("cloud", "Dosyalarım", 30, Color.WHITE, () -> navigate(null, 0));
        cloud.setBackground(a.shape(0xff4269db, 8)); top.addView(cloud);
        LinearLayout brand = a.row(); LinearLayout.LayoutParams brandLp = new LinearLayout.LayoutParams(0, -1, 1);
        brandLp.setMargins(a.dp(8), 0, 0, 0); top.addView(brand, brandLp);
        TextView kerem = text("kerem", 22, a.ink, 800); kerem.setTypeface(a.font("manrope", 800));
        TextView drive = text("drive", 22, a.ink, 500); drive.setTypeface(a.font("manrope", 500));
        TextView period = text(".", 22, a.accent, 800); period.setTypeface(a.font("manrope", 800));
        brand.addView(kerem); brand.addView(drive); brand.addView(period);
        brand.setContentDescription("Kerem Drive konumlar menüsü"); brand.setOnClickListener(v -> navigationMenu());
        top.addView(glyph(dark ? "sun" : "moon", dark ? "Açık tema" : "Koyu tema", 36, a.muted, () -> {
            dark = !dark; prefs.edit().putBoolean("dark", dark).apply(); render();
        }));
        top.addView(glyph("trash", trash() ? "Dosyalarıma dön" : "Çöp kutusu", 36, trash() ? a.accent : a.muted, () -> navigate(null, trash() ? 0 : 3)));
        if (!wide) a.space(header, 8);
        LinearLayout search = a.row(); search.setPadding(a.dp(7), 0, a.dp(4), 0);
        search.setBackground(Ui.border(a, a.bg, lineColor(), 9));
        if (wide) {
            LinearLayout.LayoutParams searchLp = new LinearLayout.LayoutParams(a.dp(Math.min(350, a.getResources().getConfiguration().screenWidthDp / 3)), a.dp(44));
            searchLp.setMargins(a.dp(20), 0, a.dp(12), 0); top.addView(search, 2, searchLp);
        } else header.addView(search, new LinearLayout.LayoutParams(-1, a.dp(44)));
        search.addView(glyph("search", "Dosyalarda ara", 30, a.muted, this::submitSearch));
        searchField = new EditText(a); searchField.setSingleLine(true); searchField.setTextSize(12);
        searchField.setTypeface(a.font("dm", 400)); searchField.setTextColor(a.ink); searchField.setHintTextColor(a.muted);
        searchField.setHint("Dosyalarda ara"); searchField.setBackgroundColor(Color.TRANSPARENT); searchField.setPadding(a.dp(4), 0, 0, 0);
        searchField.setText(query); searchField.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH);
        search.addView(searchField, new LinearLayout.LayoutParams(0, -1, 1));
        View clear = glyph("close", "Aramayı temizle", 28, a.muted, () -> searchField.setText("")); search.addView(clear);
        clear.setVisibility(query.isEmpty() ? View.GONE : View.VISIBLE);
        searchField.setOnEditorActionListener((v, id, event) -> {
            if (id != android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH && (event == null || event.getKeyCode() != android.view.KeyEvent.KEYCODE_ENTER)) return false;
            submitSearch(); return true;
        });
        searchField.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence t, int start, int count, int after) {}
            public void onTextChanged(CharSequence t, int start, int before, int count) {
                clear.setVisibility(t.length() == 0 ? View.GONE : View.VISIBLE);
                if (searchPending != null) MAIN.removeCallbacks(searchPending);
                final String value = t.toString().trim(); final LinearLayout page = body;
                searchPending = () -> { if (alive(page) && !query.equals(value)) { query = value; load(); } };
                MAIN.postDelayed(searchPending, 300);
            }
            public void afterTextChanged(android.text.Editable t) {}
        });
        View headerLine = new View(a); headerLine.setBackgroundColor(lineColor());
        a.root.addView(headerLine, 1, new LinearLayout.LayoutParams(-1, a.dp(1)));
        body.setPadding(a.dp(wide ? 24 : 10), a.dp(wide ? 22 : 23), a.dp(wide ? 24 : 10), 0);
        LinearLayout workspace = wide ? a.row() : a.column(); body.addView(workspace, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout headingInfo = a.column(); workspace.addView(headingInfo, new LinearLayout.LayoutParams(wide ? 0 : -1, -2, wide ? 1 : 0));
        TextView eyebrow = text("KEREM DRIVE", 7, subtleColor(), 600); eyebrow.setLetterSpacing(.22f); headingInfo.addView(eyebrow);
        a.space(headingInfo, 10);
        LinearLayout title = a.row(); headingInfo.addView(title, new LinearLayout.LayoutParams(-1, a.dp(34)));
        workspaceTitle = text("Dosyalarım", 25, a.ink, 700); workspaceTitle.setTypeface(a.font("manrope", 700));
        workspaceTitle.setSingleLine(true); workspaceTitle.setEllipsize(android.text.TextUtils.TruncateAt.END);
        workspaceTitle.setMaxWidth(a.dp(wide ? 260 : a.getResources().getConfiguration().screenWidthDp - 110)); title.addView(workspaceTitle);
        itemCount = text("…", 9, a.muted, 400); itemCount.setPadding(a.dp(6), a.dp(4), a.dp(6), a.dp(4));
        itemCount.setBackground(Ui.border(a, a.surface, lineColor(), 5)); LinearLayout.LayoutParams countLp = new LinearLayout.LayoutParams(-2, -2);
        countLp.setMargins(a.dp(10), 0, 0, 0); title.addView(itemCount, countLp);
        if (!wide) a.space(workspace, 17);
        LinearLayout create = a.row(); workspace.addView(create, new LinearLayout.LayoutParams(wide ? -2 : -1, a.dp(44)));
        if (trash()) compactButton(create, "Dosyalarıma dön", "back", false, () -> navigate(null, 0));
        else {
            compactButton(create, "Klasör yükle", null, false, this::pickFolder);
            if (!wide) create.addView(new View(a), new LinearLayout.LayoutParams(0, 1, 1)); else gap(create, 8);
            compactButton(create, "Yeni klasör", "plus", false, this::newFolder);
            gap(create, 6); compactButton(create, "Dosya yükle", "upload", true, () -> pickDocuments(false));
        }
        a.space(body, 18);
        LinearLayout panel = a.column(); panel.setBackground(Ui.border(a, a.surface, lineColor(), 10)); panel.setClipToOutline(true);
        body.addView(panel, new LinearLayout.LayoutParams(-1, -2));
        panel.setMinimumHeight(a.dp(Math.max(360, a.getResources().getConfiguration().screenHeightDp - (wide ? 220 : 305))));
        status = a.column(); panel.addView(status); Ui.line(a, panel, lineColor());
        selection = a.column(); panel.addView(selection);
        list = a.column(); list.setPadding(a.dp(13), a.dp(13), a.dp(13), a.dp(13));
        panel.addView(list, new LinearLayout.LayoutParams(-1, 0, 1));
        list.setOnLongClickListener(v -> { workspaceMenu(); return true; });
        Ui.line(a, panel, lineColor());
        fileCounts = text("Dosyalar yükleniyor…", 8, subtleColor(), 400); fileCounts.setGravity(Gravity.CENTER_VERTICAL);
        fileCounts.setPadding(a.dp(16), 0, a.dp(16), 0); panel.addView(fileCounts, new LinearLayout.LayoutParams(-1, a.dp(36)));
        statsBox = a.row(); body.addView(statsBox, new LinearLayout.LayoutParams(-1, a.dp(44)));
        View dot = new View(a); dot.setBackground(a.shape(0xff74a58e, 3)); statsBox.addView(dot, new LinearLayout.LayoutParams(a.dp(5), a.dp(5)));
        TextView personal = text("Kişisel depolama", 7, subtleColor(), 400); LinearLayout.LayoutParams personalLp = new LinearLayout.LayoutParams(0, -2, 1);
        personalLp.setMargins(a.dp(7), 0, a.dp(8), 0); statsBox.addView(personal, personalLp);
        storageSummary = text("Bağlanıyor…", 7, subtleColor(), 400); storageSummary.setSingleLine(true); statsBox.addView(storageSummary);
        statsBox.setContentDescription("Depolama ayrıntıları"); statsBox.setOnClickListener(v -> storageDetails());
        if (!trash()) dropTarget(list, parent);
        body.setFocusableInTouchMode(true);
        body.setOnKeyListener((view, code, event) -> shortcut(code, event));
        if (android.os.Build.VERSION.SDK_INT >= 28) a.root.addOnUnhandledKeyEventListener((view, event) -> alive(body) && shortcut(event.getKeyCode(), event));
        load();
        body.requestFocus();
    }
    private void bindLifecycle(LinearLayout page, Runnable redraw) {
        final int width = a.getResources().getConfiguration().screenWidthDp;
        final View root = a.root;
        View.OnLayoutChangeListener resize = (view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
            if (right - left != oldRight - oldLeft && a.getResources().getConfiguration().screenWidthDp != width)
                page.post(() -> { if (alive(page)) redraw.run(); });
        };
        root.addOnLayoutChangeListener(resize);
        page.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener() {
            public void onViewAttachedToWindow(View view) {}
            public void onViewDetachedFromWindow(View view) {
                ++loadId;
                root.removeOnLayoutChangeListener(resize);
                if (searchPending != null) MAIN.removeCallbacks(searchPending);
                if (activeTransfer != null) activeTransfer.cancel();
                for (android.app.Dialog dialog : new ArrayList<>(dialogs)) if (dialog.isShowing()) dialog.dismiss();
                dialogs.clear();
            }
        });
    }
    private <T extends android.app.Dialog> T showDialog(T dialog) {
        if (a.isFinishing() || a.isDestroyed()) return dialog;
        dialogs.add(dialog); dialog.setOnDismissListener(d -> dialogs.remove(dialog)); dialog.show();
        if (dialog.getWindow() != null) dialog.getWindow().setLayout(a.dp(Math.min(450, a.getResources().getConfiguration().screenWidthDp - 24)), -2);
        return dialog;
    }
    private int lineColor() { return dark ? 0xff2d3745 : 0xffe8ebf0; }
    private int subtleColor() { return dark ? 0xff79879b : 0xffa0a8b4; }
    private TextView text(String value, int size, int color, int weight) {
        TextView view = a.text(value, size, color); view.setTypeface(a.font("dm", weight)); view.setIncludeFontPadding(false); return view;
    }
    private void guarded(Runnable run) { if (!busy) run.run(); else a.toast("Devam eden işlemi bekle."); }
    private View glyph(String name, String description, int size, int color, Runnable run) {
        View view = Ui.icon(a, name, run == null ? size : Math.max(44, size), color, run == null ? null : () -> guarded(run)); view.setContentDescription(description); return view;
    }
    private void gap(LinearLayout row, int width) { row.addView(new View(a), new LinearLayout.LayoutParams(a.dp(width), 1)); }
    private void compactButton(LinearLayout row, String label, String name, boolean primary, Runnable run) {
        LinearLayout button = a.row(); button.setGravity(Gravity.CENTER); button.setPadding(a.dp(8), 0, a.dp(8), 0);
        int color = primary ? (dark ? 0xff142348 : Color.WHITE) : a.ink;
        button.setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x22808080), Ui.border(a, primary ? a.accent : a.surface, primary ? a.accent : lineColor(), 8), null));
        if (name != null) { button.addView(glyph(name, label, 22, color, null)); gap(button, 4); }
        button.setMinimumHeight(a.dp(44));
        button.addView(text(label, name == null ? 10 : 11, color, 600)); row.addView(button, new LinearLayout.LayoutParams(-2, -1));
        button.setContentDescription(label); button.setFocusable(true); button.setOnClickListener(v -> guarded(run));
    }
    private void newFolder() {
        nameDialog("Yeni klasör", "", name -> mutate("Klasör oluşturuluyor", () -> {
            request("POST", "/folders", a.obj("name", name, "parent", nullable(parent))); return "Klasör oluşturuldu.";
        }));
    }
    private void submitSearch() {
        String value = searchField.getText().toString().trim(); if (!query.equals(value)) { query = value; load(); }
        ((android.view.inputmethod.InputMethodManager) a.getSystemService(Activity.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(searchField.getWindowToken(), 0); body.requestFocus();
    }
    private String locationTitle() {
        return trash() ? "Çöp kutusu" : !query.isEmpty() ? "Arama sonuçları" : mode == 1 ? "Yıldızlı" : mode == 2 ? "Son kullanılan" : parent != null && crumbs.length() > 0 ? crumbs.optJSONObject(crumbs.length() - 1).optString("name") : "Dosyalarım";
    }
    private void navigationMenu() {
        List<String> labels = new ArrayList<>(); List<Runnable> runs = new ArrayList<>();
        for (int i = 0; i < MODES.length; i++) { final int target = i; option(labels, runs, MODES[i], () -> navigate(null, target)); }
        for (int i = 0; i < crumbs.length(); i++) { JSONObject c = crumbs.optJSONObject(i); if (c != null) option(labels, runs, "› " + c.optString("name"), () -> navigate(c.optString("id"), 0)); }
        option(labels, runs, "Keremhub ana sayfa", a::hub);
        choose("Konumlar", labels.toArray(new String[0]), i -> guarded(runs.get(i)));
    }
    private void workspaceMenu() {
        List<String> labels = new ArrayList<>(); List<Runnable> runs = new ArrayList<>();
        option(labels, runs, "Konumlar · " + MODES[mode], this::navigationMenu);
        option(labels, runs, "Sıralama · " + SORTS[sort], () -> choose("Sıralama (klasörler önce)", SORTS, i -> { sort = i; prefs.edit().putInt("sort", i).apply(); drawItems(); }));
        option(labels, runs, "Tür filtresi · " + TYPES[type], () -> choose("Dosya türü", TYPES, i -> { type = i; selected.clear(); drawItems(); drawToolbar(); }));
        option(labels, runs, "Tümünü seç", () -> { for (JSONObject item : visible()) selected.add(item.optString("id")); drawItems(); });
        if (!selected.isEmpty()) option(labels, runs, "Seçilenlerle işlemler · " + selected.size(), () -> bulkMenu(chosen()));
        if (!trash() && !session.clipboard.isEmpty()) option(labels, runs, "Buraya yapıştır · " + session.clipboard.size() + " öğe", this::paste);
        if (!query.isEmpty() || type != 0) option(labels, runs, "Aramayı ve filtreyi temizle", () -> { type = 0; searchField.setText(""); query = ""; load(); });
        option(labels, runs, "Depolama ayrıntıları", this::storageDetails);
        choose("Dosya alanı", labels.toArray(new String[0]), i -> guarded(runs.get(i)));
    }
    private void drawToolbar() {
        status.removeAllViews(); LinearLayout row = a.row(); row.setPadding(a.dp(8), 0, a.dp(7), 0);
        status.addView(row, new LinearLayout.LayoutParams(-1, a.dp(64)));
        boolean canUp = query.isEmpty() && (parent != null || mode != 0);
        View up = glyph("up", "Üst klasör", 28, canUp ? a.muted : subtleColor(), () -> navigate(parent != null && crumbs.length() > 1 ? crumbs.optJSONObject(crumbs.length() - 2).optString("id") : null, 0));
        up.setEnabled(canUp); up.setAlpha(canUp ? 1 : .45f); row.addView(up);
        View divider = new View(a); divider.setBackgroundColor(lineColor()); row.addView(divider, new LinearLayout.LayoutParams(a.dp(1), a.dp(20)));
        HorizontalScrollView crumbScroll = new HorizontalScrollView(a); crumbScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout crumb = a.row(); row.addView(crumbScroll, new LinearLayout.LayoutParams(0, -1, 1));
        crumbScroll.addView(crumb, new HorizontalScrollView.LayoutParams(-2, -1));
        crumb.addView(glyph(trash() ? "trash" : "drive", "Konumlar", 24, a.muted, null));
        TextView location = text(parent == null ? MODES[mode] : "Dosyalarım", 10, a.muted, 400); location.setSingleLine(true); location.setGravity(Gravity.CENTER_VERTICAL);
        location.setPadding(a.dp(5), 0, a.dp(5), 0); crumb.addView(location, new LinearLayout.LayoutParams(-2, a.dp(44)));
        location.setContentDescription("Konumlar: " + MODES[mode]); location.setOnClickListener(v -> navigationMenu()); location.setFocusable(true);
        if (parent != null) for (int i = 0; i < crumbs.length(); i++) {
            JSONObject c = crumbs.optJSONObject(i); if (c == null) continue;
            crumb.addView(text(" › ", 12, subtleColor(), 400));
            TextView part = text(c.optString("name"), 10, a.ink, 500); part.setMaxWidth(a.dp(145)); part.setSingleLine(true); part.setEllipsize(android.text.TextUtils.TruncateAt.END); part.setGravity(Gravity.CENTER_VERTICAL);
            crumb.addView(part, new LinearLayout.LayoutParams(-2, a.dp(44))); part.setFocusable(true); part.setOnClickListener(v -> navigate(c.optString("id"), 0)); dropTarget(part, c.optString("id"));
        }
        if (!query.isEmpty()) crumb.addView(text(" › “" + query + "”", 10, a.ink, 500));
        if (!trash()) dropTarget(location, null);
        if (wide) {
            TextView sorting = text(SORTS[sort] + " ▾", 11, a.muted, 400); sorting.setPadding(a.dp(8), 0, a.dp(8), 0); sorting.setGravity(Gravity.CENTER);
            row.addView(sorting, new LinearLayout.LayoutParams(-2, a.dp(44))); sorting.setContentDescription("Sıralama"); sorting.setFocusable(true);
            sorting.setOnClickListener(v -> choose("Sıralama", SORTS, i -> { sort = i; prefs.edit().putInt("sort", i).apply(); drawItems(); drawToolbar(); }));
        }
        LinearLayout toggle = a.row(); toggle.setPadding(a.dp(2), a.dp(2), a.dp(2), a.dp(2)); toggle.setBackground(Ui.border(a, a.surface, lineColor(), 7)); row.addView(toggle);
        for (boolean isGrid : new boolean[]{true, false}) {
            View view = glyph(isGrid ? "grid" : "list", isGrid ? "Izgara görünümü" : "Liste görünümü", 26, grid == isGrid ? a.ink : subtleColor(), () -> { grid = isGrid; prefs.edit().putBoolean("grid", grid).apply(); drawItems(); drawToolbar(); });
            view.setSelected(grid == isGrid); if (grid == isGrid) view.setBackground(a.shape(a.bg, 5)); toggle.addView(view);
        }
        row.addView(glyph("refresh", "Yenile", 30, a.muted, this::load));
        row.addView(glyph("more", "Sıralama, filtre ve dosya işlemleri" + (type == 0 ? "" : ", " + TYPES[type]), 26, type == 0 ? a.muted : a.accent, this::workspaceMenu));
    }
    private void storageDetails() {
        StringBuilder details = new StringBuilder(a.bytes(storage.optDouble("used")) + " kullanılıyor · " + a.bytes(storage.optDouble("free")) + " boş\n" + a.bytes(storage.optDouble("total")) + " toplam disk\n" + storage.optLong("count") + " dosya · " + storage.optLong("folders") + " klasör\nÇöp kutusu: " + storage.optLong("trash") + " öğe (alt öğeler dahil)");
        JSONArray categories = storage.optJSONArray("categories");
        if (categories != null) for (int i = 0; i < categories.length(); i++) {
            JSONObject c = categories.optJSONObject(i); if (c == null) continue;
            String k = c.optString("category"); String label = k.equals("image") ? "Görseller" : k.equals("video") ? "Videolar" : k.equals("audio") ? "Ses" : "Belgeler / diğer";
            details.append("\n").append(label).append(" · ").append(c.optLong("count")).append(" dosya · ").append(a.bytes(c.optDouble("size")));
        }
        showDialog(new AlertDialog.Builder(dialogContext()).setTitle("Depolama").setMessage(storage.length() == 0 ? storageSummary.getText() : details.toString()).setPositiveButton("Tamam", null).setNeutralButton("Yenile", (d, w) -> load()).create());
    }
    private void navigate(String id, int newMode) {
        a.navigate(() -> {
            DriveScreen next = new DriveScreen(a, session);
            next.parent = id; next.mode = newMode; if (newMode == 2) next.sort = 2; next.render();
        });
    }
    private LinearLayout horizontal(LinearLayout into) {
        HorizontalScrollView scroll = new HorizontalScrollView(a);
        scroll.setHorizontalScrollBarEnabled(false);
        LinearLayout row = a.row(); row.setGravity(Gravity.CENTER_VERTICAL);
        scroll.addView(row); into.addView(scroll);
        return row;
    }
    private TextView action(LinearLayout into, String label, Runnable run) {
        TextView button = a.button(into, label, () -> { if (!busy) run.run(); else a.toast("Devam eden işlemi bekle."); });
        button.setMinHeight(a.dp(48));
        if (into.getOrientation() == LinearLayout.HORIZONTAL) {
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
            lp.setMargins(a.dp(3), a.dp(4), a.dp(3), a.dp(4)); button.setLayoutParams(lp);
        }
        button.setContentDescription(label);
        return button;
    }
    private android.content.Context dialogContext() {
        return new android.view.ContextThemeWrapper(a, dark ? android.R.style.Theme_Material_Dialog_Alert : android.R.style.Theme_Material_Light_Dialog_Alert);
    }
    private void choose(String title, String[] labels, java.util.function.IntConsumer selected) {
        showDialog(new AlertDialog.Builder(dialogContext()).setTitle(title).setItems(labels, (d, i) -> selected.accept(i)).setNegativeButton("Vazgeç", null).create());
    }
    private void confirm(String title, String message, Runnable yes) {
        showDialog(new AlertDialog.Builder(dialogContext()).setTitle(title).setMessage(message).setNegativeButton("Vazgeç", null).setPositiveButton("Onayla", (d, i) -> yes.run()).create());
    }
    private void load() {
        final long version = ++loadId;
        final LinearLayout page = body;
        loading = true; selected.clear(); drawToolbar(); drawItems();
        String path = "/items?mode=" + MODE_KEYS[mode] + "&parent=" + a.enc(parent == null ? "" : parent) + "&q=" + a.enc(query);
        async(() -> request("GET", path, null), data -> {
            if (version != loadId) return;
            items.clear(); JSONArray array = data.optJSONArray("items");
            if (array != null) for (int i = 0; i < array.length(); i++) if (array.optJSONObject(i) != null) items.add(array.optJSONObject(i));
            crumbs = data.optJSONArray("crumbs"); if (crumbs == null) crumbs = new JSONArray();
            loading = false; drawToolbar(); drawItems();
        }, error -> {
            if (version != loadId) return;
            loading = false; items.clear(); drawItems(); list.removeAllViews();
            emptyMessage("Dosyalar yüklenemedi", error, true); fileCounts.setText("Bağlantı kurulamadı");
        }, page);
        storageSummary.setText("Bağlanıyor…");
        async(() -> request("GET", "/stats", null), s -> {
            if (version != loadId) return;
            storage = s; storageSummary.setText(a.bytes(s.optDouble("used")) + " kullanılıyor · " + a.bytes(s.optDouble("free")) + " boş");
        }, error -> {
            if (version != loadId) return;
            storageSummary.setText("Depolama alınamadı · Yenile");
        }, page);
    }
    private List<JSONObject> visible() {
        List<JSONObject> result = new ArrayList<>();
        for (JSONObject item : items) if ((type == 0 || kind(item).equals(TYPE_KEYS[type])) &&
                (!trash() || query.isEmpty() || item.optString("name").toLowerCase(TR).contains(query.toLowerCase(TR)))) result.add(item);
        java.text.Collator collator = java.text.Collator.getInstance(TR);
        Comparator<JSONObject> compare = (x, y) -> {
            if (folder(x) != folder(y)) return folder(x) ? -1 : 1;
            int order;
            switch (sort) {
                case 1: order = collator.compare(y.optString("name"), x.optString("name")); break;
                case 2: order = y.optString("updated").compareTo(x.optString("updated")); break;
                case 3: order = x.optString("updated").compareTo(y.optString("updated")); break;
                case 4: order = Double.compare(y.optDouble("size"), x.optDouble("size")); break;
                case 5: order = Double.compare(x.optDouble("size"), y.optDouble("size")); break;
                case 6: order = y.optString("created").compareTo(x.optString("created")); break;
                default: order = collator.compare(x.optString("name"), y.optString("name"));
            }
            return order == 0 ? x.optString("id").compareTo(y.optString("id")) : order;
        };
        result.sort(compare); return result;
    }
    private void drawItems() {
        list.removeAllViews(); drawSelection(); workspaceTitle.setText(locationTitle());
        List<JSONObject> rows = visible(); itemCount.setText(loading ? "…" : rows.size() + " öğe");
        if (loading) { emptyMessage("Dosyalar yükleniyor…", "", false); fileCounts.setText("Dosyalar yükleniyor…"); return; }
        updateCounts();
        if (rows.isEmpty()) {
            emptyMessage(trash() ? "Çöp kutusu boş." : query.isEmpty() && type == 0 ? "Bu alan sana ait." : "Eşleşen dosya bulunamadı.",
                    trash() ? "Sildiğin dosyalar burada görünür." : "Dosyalarını buraya sürükle veya yükleyerek başla.", false);
            return;
        }
        int columns = wide ? Math.max(2, (a.getResources().getConfiguration().screenWidthDp - 61) / 168) : 2;
        if (!grid && wide) {
            LinearLayout heading = a.row(); heading.setPadding(a.dp(12), 0, a.dp(12), 0); list.addView(heading, new LinearLayout.LayoutParams(-1, a.dp(38)));
            heading.addView(text("Ad", 10, subtleColor(), 400), new LinearLayout.LayoutParams(0, -2, 1));
            listCell(heading, "Son değiştirilme", 125, true); listCell(heading, "Tür", 105, true); listCell(heading, "Boyut", 70, true); gap(heading, 44);
        }
        LinearLayout gridRow = null;
        for (int i = 0; i < rows.size(); i++) {
            JSONObject item = rows.get(i); String id = item.optString("id");
            if (grid && i % columns == 0) { gridRow = a.row(); gridRow.setGravity(Gravity.TOP); list.addView(gridRow, new LinearLayout.LayoutParams(-1, -2)); }
            LinearLayout tile = a.column();
            LinearLayout.LayoutParams tileLp = grid ? new LinearLayout.LayoutParams(0, a.dp(170), 1) : new LinearLayout.LayoutParams(-1, a.dp(66));
            tileLp.setMargins(0, 0, grid && i % columns != columns - 1 ? a.dp(11) : 0, grid ? a.dp(11) : 0);
            (grid ? gridRow : list).addView(tile, tileLp); styleTile(tile, selected.contains(id));
            if (!session.copy) for (JSONObject cut : session.clipboard) if (id.equals(cut.optString("id"))) { tile.setAlpha(.5f); break; }
            CheckBox check = new CheckBox(a); check.setButtonDrawable(new SelectionMark()); check.setButtonTintList(null); check.setPadding(a.dp(10), 0, 0, 0);
            check.setMinWidth(0); check.setMinHeight(0); check.setContentDescription(item.optString("name") + " seç"); check.setChecked(selected.contains(id));
            View menu = glyph("more", item.optString("name") + " işlemleri", 32, a.muted, () -> itemMenu(item));
            if (grid) {
                LinearLayout head = a.row(); tile.addView(head, new LinearLayout.LayoutParams(-1, a.dp(44)));
                head.addView(check, new LinearLayout.LayoutParams(a.dp(44), -1)); head.addView(new View(a), new LinearLayout.LayoutParams(0, 1, 1)); head.addView(menu);
                if (!trash() && kind(item).equals("image")) {
                    LinearLayout thumbnail = a.column(); thumbnail.setPadding(a.dp(10), 0, a.dp(10), 0); tile.addView(thumbnail, new LinearLayout.LayoutParams(-1, a.dp(72)));
                    a.image(thumbnail, content(item, true), 72, () -> { if (selected.isEmpty()) open(item); else toggle(item); });
                } else tile.addView(new FileArt(item), new LinearLayout.LayoutParams(-1, a.dp(72)));
                LinearLayout names = a.column(); names.setPadding(a.dp(12), a.dp(6), a.dp(12), a.dp(10)); tile.addView(names, new LinearLayout.LayoutParams(-1, 0, 1));
                addFileName(names, item, 11); a.space(names, 7); names.addView(text(folder(item) ? "Klasör" : label(item) + " · " + a.bytes(item.optDouble("size")), 9, a.muted, 400));
            } else {
                LinearLayout row = a.row(); tile.addView(row, new LinearLayout.LayoutParams(-1, -1));
                row.addView(check, new LinearLayout.LayoutParams(a.dp(44), -1)); row.addView(new FileArt(item), new LinearLayout.LayoutParams(a.dp(35), a.dp(42)));
                LinearLayout names = a.column(); names.setPadding(a.dp(8), 0, a.dp(4), 0); row.addView(names, new LinearLayout.LayoutParams(0, -2, 1));
                addFileName(names, item, wide ? 12 : 11);
                if (wide) { listCell(row, date(item.optString(trash() ? "deleted" : "updated")), 125, false); listCell(row, label(item), 105, false); }
                listCell(row, folder(item) ? "—" : a.bytes(item.optDouble("size")), wide ? 70 : 54, false); row.addView(menu);
            }
            tile.setContentDescription(item.optString("name") + ", " + label(item)); tile.setFocusable(true);
            tile.setOnClickListener(v -> { if (!selected.isEmpty()) toggle(item); else open(item); });
            tile.setOnLongClickListener(v -> {
                if (!trash() && selected.contains(id)) {
                    android.content.ClipData data = android.content.ClipData.newPlainText("Kerem Drive", "Öğeleri taşı");
                    return tile.startDragAndDrop(data, new View.DragShadowBuilder(tile), new DragItems(chosen()), 0);
                }
                toggle(item); return true;
            });
            if (!trash() && folder(item)) dropTarget(tile, id);
            check.setOnCheckedChangeListener((v, checked) -> {
                if (checked) selected.add(id); else selected.remove(id);
                styleTile(tile, checked); drawSelection(); updateCounts();
            });
        }
        if (grid && rows.size() % columns != 0) for (int i = rows.size() % columns; i < columns; i++) {
            LinearLayout.LayoutParams spacer = new LinearLayout.LayoutParams(0, 1, 1); spacer.setMargins(0, 0, i == columns - 1 ? 0 : a.dp(11), 0); gridRow.addView(new View(a), spacer);
        }
    }
    private void listCell(LinearLayout row, String value, int width, boolean heading) {
        TextView cell = text(value, wide ? 10 : 9, heading ? subtleColor() : a.muted, 400); cell.setSingleLine(true); cell.setEllipsize(android.text.TextUtils.TruncateAt.END);
        row.addView(cell, new LinearLayout.LayoutParams(a.dp(width), -2));
    }
    private void styleTile(View tile, boolean checked) {
        tile.setBackground(Ui.border(a, checked ? (dark ? 0xff283851 : 0xffedf2ff) : a.surface, checked ? a.accent : lineColor(), 11));
    }
    private void addFileName(LinearLayout parent, JSONObject item, int size) {
        TextView name = text((item.optInt("star") == 1 ? "★ " : "") + item.optString("name"), size, a.ink, 600);
        name.setSingleLine(true); name.setEllipsize(android.text.TextUtils.TruncateAt.END); parent.addView(name, new LinearLayout.LayoutParams(-1, -2));
    }
    private void updateCounts() {
        int folders = 0; List<JSONObject> rows = visible(); double size = 0;
        for (JSONObject item : rows) { if (folder(item)) folders++; else size += item.optDouble("size"); }
        fileCounts.setText(selected.isEmpty() ? folders +  " klasör · " + (rows.size() - folders) + " dosya" + (type == 0 ? "" : " · " + TYPES[type]) : selected.size() + " öğe seçili");
        fileCounts.setContentDescription(fileCounts.getText() + " · " + a.bytes(size));
    }
    private void emptyMessage(String title, String detail, boolean retry) {
        LinearLayout empty = a.column(); empty.setGravity(Gravity.CENTER); empty.setPadding(a.dp(16), a.dp(30), a.dp(16), a.dp(30));
        empty.setMinimumHeight(a.dp(wide ? 270 : 330)); list.addView(empty, new LinearLayout.LayoutParams(-1, -2));
        if (loading) { android.widget.ProgressBar spinner = new android.widget.ProgressBar(a); spinner.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(a.accent)); empty.addView(spinner, new LinearLayout.LayoutParams(a.dp(28), a.dp(28))); }
        else empty.addView(glyph(trash() ? "trash" : "folder", title, 58, subtleColor(), null)); a.space(empty, 12);
        TextView heading = text(title, 16, a.ink, 600); heading.setGravity(Gravity.CENTER); empty.addView(heading);
        if (!detail.isEmpty()) { a.space(empty, 8); TextView note = text(detail, 11, a.muted, 400); note.setGravity(Gravity.CENTER); empty.addView(note); }
        if (!loading && !retry && !trash() && query.isEmpty() && type == 0) {
            a.space(empty, 20); LinearLayout upload = a.row(); empty.addView(upload, new LinearLayout.LayoutParams(-2, a.dp(44))); compactButton(upload, "Dosya seç", "upload", false, () -> pickDocuments(false));
        }
        if (retry) { a.space(empty, 16); LinearLayout buttons = a.row(); empty.addView(buttons); compactButton(buttons, "Yeniden dene", "refresh", false, this::load); buttons.setMinimumHeight(a.dp(36)); }
    }
    /** A real filled folder silhouette, rather than a font-dependent Unicode symbol. */
    private final class FileArt extends View {
        private final JSONObject item;
        private final android.graphics.Paint paint = new android.graphics.Paint(3);
        FileArt(JSONObject item) { super(a); this.item = item; setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO); }
        @Override protected void onDraw(android.graphics.Canvas canvas) {
            super.onDraw(canvas); float side = Math.min(Math.min(getWidth(), getHeight()), a.dp(grid ? 53 : 28));
            canvas.save(); canvas.translate((getWidth() - side) / 2, (getHeight() - side) / 2); canvas.scale(side / 56, side / 56);
            paint.setStrokeJoin(android.graphics.Paint.Join.ROUND); paint.setStrokeCap(android.graphics.Paint.Cap.ROUND);
            android.graphics.Path path = new android.graphics.Path();
            if (folder(item)) {
                path.moveTo(5, 44); path.lineTo(5, 14); path.quadTo(5, 8, 11, 8); path.lineTo(20, 8);
                path.quadTo(23, 8, 25, 11); path.lineTo(28, 15); path.lineTo(45, 15); path.quadTo(51, 15, 51, 21);
                path.lineTo(51, 45); path.quadTo(51, 49, 46, 49); path.lineTo(10, 49); path.quadTo(5, 49, 5, 44); path.close();
                paint.setStyle(android.graphics.Paint.Style.FILL); paint.setColor(0xffecd49e); canvas.drawPath(path, paint);
                paint.setStyle(android.graphics.Paint.Style.STROKE); paint.setStrokeWidth(3.2f); paint.setColor(0xffd1ae67); canvas.drawPath(path, paint);
            } else {
                int color = iconColor(item); paint.setStyle(android.graphics.Paint.Style.FILL); paint.setColor(dark ? 0xff232b36 : 0xffeff2f8);
                path.moveTo(12, 3); path.lineTo(33, 3); path.lineTo(46, 16); path.lineTo(46, 50); path.quadTo(46, 53, 43, 53); path.lineTo(12, 53); path.quadTo(9, 53, 9, 50); path.lineTo(9, 6); path.quadTo(9, 3, 12, 3); path.close(); canvas.drawPath(path, paint);
                paint.setStyle(android.graphics.Paint.Style.STROKE); paint.setStrokeWidth(1.8f); paint.setColor(color); canvas.drawPath(path, paint);
                android.graphics.Path fold = new android.graphics.Path(); fold.moveTo(33, 3); fold.lineTo(33, 16); fold.lineTo(46, 16); canvas.drawPath(fold, paint);
                paint.setStyle(android.graphics.Paint.Style.FILL); paint.setTypeface(a.font("dm", 700)); paint.setTextSize(10); paint.setTextAlign(android.graphics.Paint.Align.CENTER);
                String type = kind(item); String badge = type.equals("docx") ? "DOC" : type.equals("xlsx") ? "XLS" : type.equals("audio") ? "AUDIO" : type.equals("video") ? "VIDEO" : type.equals("image") ? "IMG" : ext(item).toUpperCase(TR);
                canvas.drawText(badge.isEmpty() ? "FILE" : badge.substring(0, Math.min(5, badge.length())), 28, 36, paint);
            }
            canvas.restore();
        }
    }
    private final class SelectionMark extends android.graphics.drawable.Drawable {
        private final android.graphics.Paint paint = new android.graphics.Paint(3);
        @Override public boolean isStateful() { return true; }
        @Override protected boolean onStateChange(int[] states) { invalidateSelf(); return true; }
        @Override public int getIntrinsicWidth() { return a.dp(17); }
        @Override public int getIntrinsicHeight() { return a.dp(17); }
        @Override public void draw(android.graphics.Canvas canvas) {
            boolean checked = false; for (int state : getState()) if (state == android.R.attr.state_checked) checked = true;
            android.graphics.Rect b = getBounds(); float inset = a.dp(.6f);
            android.graphics.RectF rect = new android.graphics.RectF(b.left + inset, b.top + inset, b.right - inset, b.bottom - inset);
            paint.setStyle(android.graphics.Paint.Style.FILL); paint.setColor(checked ? a.accent : a.surface); canvas.drawRoundRect(rect, a.dp(4), a.dp(4), paint);
            paint.setStyle(android.graphics.Paint.Style.STROKE); paint.setStrokeWidth(a.dp(.8f)); paint.setColor(checked ? a.accent : (dark ? 0xff79879b : 0xffb0b6bd)); canvas.drawRoundRect(rect, a.dp(4), a.dp(4), paint);
            if (checked) { paint.setColor(dark ? 0xff142348 : Color.WHITE); paint.setStrokeWidth(a.dp(1.5f)); android.graphics.Path tick = new android.graphics.Path(); tick.moveTo(b.left + b.width() * .24f, b.top + b.height() * .5f); tick.lineTo(b.left + b.width() * .44f, b.top + b.height() * .7f); tick.lineTo(b.left + b.width() * .77f, b.top + b.height() * .3f); canvas.drawPath(tick, paint); }
        }
        @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); invalidateSelf(); }
        @Override public void setColorFilter(android.graphics.ColorFilter filter) { paint.setColorFilter(filter); invalidateSelf(); }
        @Override public int getOpacity() { return android.graphics.PixelFormat.TRANSLUCENT; }
    }
    private boolean shortcut(int code, android.view.KeyEvent event) {
        if (event.getAction() != android.view.KeyEvent.ACTION_DOWN || busy) return false;
        View focused = a.getCurrentFocus();
        boolean control = event.isCtrlPressed() || event.isMetaPressed();
        if (control && code == android.view.KeyEvent.KEYCODE_K) {
            EditText search = searchField;
            if (search != null) { search.requestFocus(); ((android.view.inputmethod.InputMethodManager) a.getSystemService(Activity.INPUT_METHOD_SERVICE)).showSoftInput(search, 0); }
            return true;
        }
        if (focused instanceof EditText) return false;
        if (control && code == android.view.KeyEvent.KEYCODE_A) { for (JSONObject item : visible()) selected.add(item.optString("id")); drawItems(); return true; }
        if (control && code == android.view.KeyEvent.KEYCODE_V && !trash() && !session.clipboard.isEmpty()) { paste(); return true; }
        if (control && (code == android.view.KeyEvent.KEYCODE_X || code == android.view.KeyEvent.KEYCODE_C) && !trash() && !selected.isEmpty()) { clipboard(chosen(), code == android.view.KeyEvent.KEYCODE_C); return true; }
        if (code == android.view.KeyEvent.KEYCODE_ESCAPE && !selected.isEmpty()) { selected.clear(); drawItems(); return true; }
        if (code == android.view.KeyEvent.KEYCODE_FORWARD_DEL && !selected.isEmpty()) { delete(chosen()); return true; }
        if (code == android.view.KeyEvent.KEYCODE_ENTER && selected.size() == 1) { open(chosen().get(0)); return true; }
        if (code == android.view.KeyEvent.KEYCODE_F2 && selected.size() == 1 && !trash()) {
            JSONObject item = chosen().get(0);
            nameDialog("Yeniden adlandır", item.optString("name"), name -> mutate("Ad değiştiriliyor", () -> { request("PATCH", itemPath(item), a.obj("name", name)); return "İsim güncellendi."; })); return true;
        }
        return false;
    }
    private static EditText findInput(View root) {
        if (root instanceof EditText) return (EditText) root;
        if (root instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) { EditText found = findInput(group.getChildAt(i)); if (found != null) return found; }
        }
        return null;
    }
    private void dropTarget(View view, String target) {
        view.setOnDragListener((v, event) -> {
            boolean local = event.getLocalState() instanceof DragItems;
            switch (event.getAction()) {
                case android.view.DragEvent.ACTION_DRAG_STARTED:
                    return !busy && (local || (event.getClipDescription() != null && (event.getClipDescription().hasMimeType("text/uri-list") || event.getClipDescription().hasMimeType("application/*") || event.getClipDescription().hasMimeType("image/*") || event.getClipDescription().hasMimeType("video/*") || event.getClipDescription().hasMimeType("audio/*"))));
                case android.view.DragEvent.ACTION_DRAG_ENTERED: v.setAlpha(.65f); return true;
                case android.view.DragEvent.ACTION_DRAG_EXITED:
                case android.view.DragEvent.ACTION_DRAG_ENDED: v.setAlpha(1); return true;
                case android.view.DragEvent.ACTION_DROP:
                    v.setAlpha(1); if (busy) return false;
                    if (local) { move(((DragItems) event.getLocalState()).items, target); return true; }
                    android.content.ClipData data = event.getClipData(); List<Uri> files = new ArrayList<>();
                    if (data != null) for (int i = 0; i < data.getItemCount(); i++) { Uri uri = data.getItemAt(i).getUri(); if (uri != null && "content".equals(uri.getScheme())) files.add(uri); }
                    if (files.isEmpty()) return false;
                    android.view.DragAndDropPermissions permission = a.requestDragAndDropPermissions(event);
                    uploadFiles(files, target, permission == null ? () -> {} : permission::release); return true;
                default: return true;
            }
        });
    }
    private void toggle(JSONObject item) {
        String id = item.optString("id"); if (!selected.remove(id)) selected.add(id); drawItems();
    }
    private List<JSONObject> chosen() {
        List<JSONObject> result = new ArrayList<>(); for (JSONObject item : items) if (selected.contains(item.optString("id"))) result.add(item); return result;
    }
    private void drawSelection() {
        selection.removeAllViews(); selection.setVisibility(selected.isEmpty() ? View.GONE : View.VISIBLE);
        if (selected.isEmpty()) return;
        LinearLayout row = a.row(); row.setPadding(a.dp(12), 0, a.dp(6), 0); row.setBackgroundColor(dark ? 0xff283851 : 0xffedf2ff);
        selection.addView(row, new LinearLayout.LayoutParams(-1, a.dp(48)));
        row.addView(text(selected.size() + " öğe seçili", 10, a.ink, 600), new LinearLayout.LayoutParams(0, -2, 1));
        row.addView(glyph("more", "Seçilenlerle işlemler", 34, a.accent, () -> bulkMenu(chosen())));
        row.addView(glyph("close", "Seçimi kaldır", 34, a.muted, () -> { selected.clear(); drawItems(); }));
    }
    private void itemMenu(JSONObject item) {
        if (!selected.isEmpty() && selected.contains(item.optString("id"))) { bulkMenu(chosen()); return; }
        List<String> labels = new ArrayList<>(); List<Runnable> runs = new ArrayList<>();
        if (trash()) {
            option(labels, runs, "Geri yükle", () -> restore(Collections.singletonList(item)));
            option(labels, runs, "Kalıcı olarak sil", () -> delete(Collections.singletonList(item)));
        } else {
            option(labels, runs, "Aç / Önizle", () -> open(item));
            if (!folder(item)) {
                option(labels, runs, "İndir", () -> a.download(content(item, false), item.optString("name"), mime(item)));
                option(labels, runs, "Paylaş", () -> a.share(content(item, false), mime(item)));
            }
            option(labels, runs, "Yeniden adlandır", () -> nameDialog("Yeniden adlandır", item.optString("name"), name -> mutate("Ad değiştiriliyor", () -> {
                request("PATCH", itemPath(item), a.obj("name", name)); return "İsim güncellendi.";
            })));
            option(labels, runs, item.optInt("star") == 1 ? "Yıldızı kaldır" : "Yıldız ekle", () -> star(Collections.singletonList(item), item.optInt("star") != 1));
            option(labels, runs, "Taşı…", () -> destination(Collections.singletonList(item), false));
            option(labels, runs, "Kopyala…", () -> destination(Collections.singletonList(item), true));
            option(labels, runs, "Kes", () -> clipboard(Collections.singletonList(item), false));
            option(labels, runs, "Kopyala (panoya)", () -> clipboard(Collections.singletonList(item), true));
            option(labels, runs, "Çöp kutusuna taşı", () -> delete(Collections.singletonList(item)));
        }
        option(labels, runs, "Özellikler", () -> properties(item));
        choose(item.optString("name"), labels.toArray(new String[0]), i -> runs.get(i).run());
    }
    private void bulkMenu(List<JSONObject> chosen) {
        if (chosen.isEmpty()) return;
        List<String> labels = new ArrayList<>(); List<Runnable> runs = new ArrayList<>();
        if (trash()) {
            option(labels, runs, "Geri yükle", () -> restore(chosen));
            option(labels, runs, "Kalıcı olarak sil", () -> delete(chosen));
        } else {
            option(labels, runs, "Taşı…", () -> destination(chosen, false));
            option(labels, runs, "Kopyala…", () -> destination(chosen, true));
            option(labels, runs, "Kes", () -> clipboard(chosen, false));
            option(labels, runs, "Kopyala (panoya)", () -> clipboard(chosen, true));
            option(labels, runs, "Yıldız ekle", () -> star(chosen, true));
            option(labels, runs, "Yıldızları kaldır", () -> star(chosen, false));
            option(labels, runs, "Dosyaları indir", () -> { for (JSONObject item : chosen) if (!folder(item)) a.download(content(item, false), item.optString("name"), mime(item)); });
            option(labels, runs, "Çöp kutusuna taşı", () -> delete(chosen));
        }
        choose(chosen.size() + " öğe", labels.toArray(new String[0]), i -> runs.get(i).run());
    }
    private static void option(List<String> labels, List<Runnable> runs, String label, Runnable run) { labels.add(label); runs.add(run); }
    private void clipboard(List<JSONObject> rows, boolean copy) {
        session.clipboard.clear(); session.clipboard.addAll(rows); session.copy = copy;
        a.toast(rows.size() + (copy ? " öğe kopyalanacak. Hedef klasörde yapıştır." : " öğe kesildi. Hedef klasörde yapıştır.")); render();
    }
    private void paste() {
        List<JSONObject> rows = new ArrayList<>(session.clipboard);
        if (session.copy) copy(rows, parent); else move(rows, parent);
    }
    private void star(List<JSONObject> rows, boolean value) {
        batch(rows, value ? "Yıldız ekleniyor" : "Yıldızlar kaldırılıyor", item -> request("PATCH", itemPath(item), a.obj("star", value)));
    }
    private void delete(List<JSONObject> rows) {
        boolean permanent = trash();
        confirm(permanent ? "Kalıcı olarak sil?" : "Çöp kutusuna taşı?", rows.size() + " öğe ve klasör içerikleri " +
                (permanent ? "kalıcı olarak silinecek. Bu işlem geri alınamaz." : "çöp kutusuna taşınacak. Daha sonra geri yükleyebilirsin."),
                () -> batch(rows, permanent ? "Kalıcı olarak siliniyor" : "Çöp kutusuna taşınıyor", item -> request("DELETE", itemPath(item) + (permanent ? "?permanent=true" : ""), null)));
    }
    private void restore(List<JSONObject> rows) { batch(rows, "Geri yükleniyor", item -> request("POST", itemPath(item) + "/restore", new JSONObject())); }
    private interface ItemWork { void run(JSONObject item) throws Exception; }
    private void batch(List<JSONObject> rows, String title, ItemWork task) {
        mutate(title, () -> {
            int done = 0; List<String> errors = new ArrayList<>();
            for (JSONObject item : rows) try { task.run(item); done++; } catch (Exception e) { errors.add(item.optString("name") + ": " + message(e)); }
            return done + " / " + rows.size() + " öğe tamamlandı." + (errors.isEmpty() ? "" : "\n" + String.join("\n", errors));
        });
    }
    private void nameDialog(String title, String initial, Consumer<String> done) {
        EditText input = new EditText(dialogContext()); input.setSingleLine(true); input.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(200)}); input.setText(initial); input.selectAll();
        input.setTextColor(a.ink); input.setHintTextColor(a.muted); input.setPadding(a.dp(20), a.dp(12), a.dp(20), a.dp(12));
        AlertDialog dialog = new AlertDialog.Builder(dialogContext()).setTitle(title).setView(input).setNegativeButton("Vazgeç", null).setPositiveButton(initial.isEmpty() ? "Oluştur" : "Kaydet", null).create();
        dialog.setOnShowListener(v -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(w -> {
            String value = Normalizer.normalize(input.getText().toString().trim(), Normalizer.Form.NFC);
            if (!validName(value)) { input.setError("Ad 1–200 karakter olmalı; /, \\, kontrol karakteri, . veya .. içermemeli."); return; }
            dialog.dismiss(); done.accept(value);
        })); showDialog(dialog);
    }
    private static boolean validName(String value) { return value != null && !value.isEmpty() && value.length() <= 200 && !value.equals(".") && !value.equals("..") && !java.util.regex.Pattern.compile("[\\x00-\\x1f/\\\\]").matcher(value).find(); }
    private void destination(List<JSONObject> rows, boolean copy) {
        async(() -> requestArray("/folders"), folders -> {
            Map<String, JSONObject> map = new HashMap<>(); for (int i = 0; i < folders.length(); i++) { JSONObject f = folders.optJSONObject(i); if (f != null) map.put(f.optString("id"), f); }
            List<String> ids = new ArrayList<>(); List<String> labels = new ArrayList<>(); ids.add(null); labels.add("Dosyalarım");
            for (int i = 0; i < folders.length(); i++) {
                JSONObject f = folders.optJSONObject(i); if (f == null || forbidden(f.optString("id"), rows, map)) continue;
                ids.add(f.optString("id")); labels.add(folderPath(f, map));
            }
            choose(copy ? "Kopyalanacak konum" : "Taşınacak konum", labels.toArray(new String[0]), i -> {
                if (copy) copy(rows, ids.get(i)); else move(rows, ids.get(i));
            });
        }, error -> a.toast("Hedefler alınamadı: " + error), body);
    }
    private static boolean forbidden(String target, List<JSONObject> rows, Map<String, JSONObject> folders) {
        Set<String> selected = new HashSet<>(); for (JSONObject r : rows) if (folder(r)) selected.add(r.optString("id"));
        Set<String> seen = new HashSet<>();
        while (target != null && seen.add(target)) { if (selected.contains(target)) return true; JSONObject f = folders.get(target); target = f == null ? null : nullString(f, "parent"); }
        return false;
    }
    private static String folderPath(JSONObject f, Map<String, JSONObject> map) {
        List<String> path = new ArrayList<>(); Set<String> seen = new HashSet<>();
        while (f != null && seen.add(f.optString("id"))) { path.add(f.optString("name")); f = map.get(nullString(f, "parent")); }
        Collections.reverse(path); return "Dosyalarım / " + String.join(" / ", path);
    }
    private void move(List<JSONObject> rows, String target) {
        boolean same = true; for (JSONObject row : rows) if (!java.util.Objects.equals(nullString(row, "parent"), target)) { same = false; break; }
        if (same) { a.toast("Öğeler zaten bu konumda."); return; }
        if (rows.size() > 200) { a.toast("Sunucu bir işlemde en fazla 200 öğeyi taşıyabilir. Daha küçük bir seçim yap."); return; }
        mutate("Taşınıyor", () -> {
            JSONArray ids = new JSONArray(); for (JSONObject r : rows) ids.put(r.optString("id"));
            JSONObject result = request("POST", "/items/move", a.obj("ids", ids, "parent", nullable(target)));
            MAIN.post(() -> session.clipboard.clear());
            return result.optInt("moved") + " öğe taşındı.";
        });
    }
    private void properties(JSONObject item) {
        async(() -> request("GET", itemPath(item) + "/properties", null), detail -> {
            JSONArray path = detail.optJSONArray("crumbs"); StringBuilder location = new StringBuilder("Dosyalarım");
            if (path != null) for (int i = 0; i < path.length(); i++) location.append(" / ").append(path.optJSONObject(i).optString("name"));
            String text = "Ad: " + detail.optString("name") + "\nTür: " + label(detail) + "\nMIME: " + mime(detail) +
                    "\nBoyut: " + a.bytes(detail.optDouble("totalSize")) + " (" + detail.optLong("totalSize") + " bayt)" +
                    (folder(item) ? "\nİçerik: " + detail.optLong("fileCount") + " dosya, " + detail.optLong("folderCount") + " klasör" : "") +
                    "\nKonum: " + location + "\nOluşturulma: " + date(detail.optString("created")) + "\nDeğiştirilme: " + date(detail.optString("updated")) +
                    (detail.isNull("deleted") ? "" : "\nSilinme: " + date(detail.optString("deleted"))) + "\nYıldızlı: " + (detail.optInt("star") == 1 ? "Evet" : "Hayır");
            TextView content = a.text(text, 15, a.ink); content.setTextIsSelectable(true); content.setPadding(a.dp(20), a.dp(12), a.dp(20), a.dp(12));
            ScrollView scroll = new ScrollView(a); scroll.setBackgroundColor(a.surface); scroll.addView(content);
            showDialog(new AlertDialog.Builder(dialogContext()).setTitle("Özellikler").setView(scroll).setPositiveButton("Kapat", null).create());
        }, error -> a.toast("Özellikler alınamadı: " + error), body);
    }

    private interface Work<T> { T run() throws Exception; }
    private <T> void async(Work<T> work, Consumer<T> done, Consumer<String> fail, LinearLayout page) {
        IO.execute(() -> { try { T result = work.run(); MAIN.post(() -> { if (alive(page)) done.accept(result); }); }
            catch (Exception e) { MAIN.post(() -> { if (alive(page)) fail.accept(message(e)); }); } });
    }
    private void mutate(String title, Work<String> work) {
        if (busy) return;
        busy = true;
        ProgressDialog dialog = new ProgressDialog(dialogContext()); dialog.setMessage(title + "…"); dialog.setCancelable(false); showDialog(dialog);
        final LinearLayout page = body;
        IO.execute(() -> {
            String result;
            try { result = work.run(); } catch (Exception e) { result = "İşlem tamamlanamadı: " + message(e); }
            final String report = result;
            MAIN.post(() -> {
                busy = false; if (dialog.isShowing()) dialog.dismiss();
                if (!alive(page)) return;
                selected.clear(); load();
                showDialog(new AlertDialog.Builder(dialogContext()).setTitle(title).setMessage(report).setPositiveButton("Tamam", null).create());
            });
        });
    }
    private HttpURLConnection connection(String path, String method) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(a.base().replaceAll("/+$", "") + API + path).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(60000); c.setRequestMethod(method);
        URL url = c.getURL(); c.setRequestProperty("Origin", url.getProtocol() + "://" + url.getAuthority());
        c.setRequestProperty("Accept", "application/json"); return c;
    }
    private Object json(String method, String path, JSONObject data) throws Exception {
        HttpURLConnection c = connection(path, method);
        try {
            if (data != null) {
                c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream out = c.getOutputStream()) { out.write(data.toString().getBytes(StandardCharsets.UTF_8)); }
            }
            return response(c);
        } finally { c.disconnect(); }
    }
    private Object response(HttpURLConnection c) throws Exception {
        int code = c.getResponseCode(); InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        String text = in == null ? "" : new String(readLimited(in, 4 * 1024 * 1024), StandardCharsets.UTF_8);
        if (code < 200 || code >= 300) {
            String error = "Sunucu hatası (" + code + ")";
            try { error = new JSONObject(text).optString("error", error); } catch (Exception ignored) { }
            throw new IOException(error);
        }
        return text.trim().isEmpty() ? new JSONObject() : new JSONTokener(text).nextValue();
    }
    private JSONObject request(String method, String path, JSONObject body) throws Exception {
        Object value = json(method, path, body); if (!(value instanceof JSONObject)) throw new IOException("Beklenmeyen sunucu yanıtı."); return (JSONObject) value;
    }
    private JSONArray requestArray(String path) throws Exception {
        Object value = json("GET", path, null); if (!(value instanceof JSONArray)) throw new IOException("Beklenmeyen klasör yanıtı."); return (JSONArray) value;
    }
    private static byte[] readLimited(InputStream stream, int limit) throws IOException {
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[32768]; int n, total = 0;
            while ((n = in.read(buffer)) != -1) { total += n; if (total > limit) throw new IOException("Önizleme boyut sınırı aşıldı."); out.write(buffer, 0, n); }
            return out.toByteArray();
        }
    }
    private static String message(Exception e) { return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage(); }
    private static Object nullable(String s) { return s == null || s.isEmpty() ? JSONObject.NULL : s; }
    private static String nullString(JSONObject o, String key) { return o.isNull(key) || o.optString(key).isEmpty() ? null : o.optString(key); }
    private static String itemPath(JSONObject item) { return "/items/" + Uri.encode(item.optString("id")); }
    private static String parentQuery(String parent) { return parent == null ? "" : "?parent=" + Uri.encode(parent); }
    private static String content(JSONObject item, boolean preview) { return API + itemPath(item) + "/content" + (preview ? "?preview=1" : ""); }
    private static boolean folder(JSONObject item) { return item.optString("kind").equals("folder"); }
    private static String ext(JSONObject item) { String n = item.optString("name"); int dot = n.lastIndexOf('.'); return dot < 0 ? "" : n.substring(dot + 1).toLowerCase(Locale.ROOT); }
    private static String mime(JSONObject item) {
        String found = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext(item));
        if (found != null) return found;
        String value = item.optString("mime", ""); return value.isEmpty() || value.equals("null") ? "application/octet-stream" : value;
    }
    private static String kind(JSONObject item) {
        if (folder(item)) return "folder"; String ext = ext(item), mime = mime(item);
        if (ext.equals("pdf") || mime.equals("application/pdf")) return "pdf";
        if (ext.equals("docx")) return "docx"; if (ext.equals("xlsx")) return "xlsx";
        if (mime.startsWith("image/") || Arrays.asList("png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico").contains(ext)) return "image";
        if (mime.startsWith("video/") || Arrays.asList("mp4", "webm", "ogv", "mov").contains(ext)) return "video";
        if (mime.startsWith("audio/") || Arrays.asList("mp3", "wav", "ogg", "m4a", "flac").contains(ext)) return "audio";
        if (mime.startsWith("text/") || Arrays.asList("txt", "md", "csv", "tsv", "json", "xml", "log", "js", "ts", "tsx", "jsx", "css", "html", "py", "yaml", "yml", "ini", "sh", "sql").contains(ext)) return "text";
        return "file";
    }
    private static String label(JSONObject item) {
        switch (kind(item)) {
            case "folder": return "Klasör"; case "image": return "Görsel"; case "video": return "Video"; case "audio": return "Ses dosyası";
            case "pdf": return "PDF belgesi"; case "docx": return "Word belgesi"; case "xlsx": return "Excel çalışma kitabı"; case "text": return "Metin belgesi";
            default: return ext(item).isEmpty() ? "Dosya" : ext(item).toUpperCase(TR) + " dosyası";
        }
    }
    private static String symbol(JSONObject item) {
        switch (kind(item)) { case "folder": return "▰"; case "image": return "▧"; case "video": return "▶"; case "audio": return "♫";
            case "pdf": return "PDF"; case "docx": return "W"; case "xlsx": return "X"; case "text": return "≡"; default: return "◇"; }
    }
    private int iconColor(JSONObject item) {
        switch (kind(item)) { case "folder": return Color.rgb(185, 146, 78); case "image": return Color.rgb(189, 147, 70);
            case "video": return Color.rgb(158, 120, 186); case "audio": case "xlsx": return Color.rgb(92, 157, 125); case "pdf": return Color.rgb(205, 121, 113); default: return a.accent; }
    }
    private static String date(String value) {
        try { return DateTimeFormatter.ofPattern("d MMM yyyy HH:mm", TR).withZone(ZoneId.systemDefault()).format(Instant.parse(value)); } catch (Exception e) { return "—"; }
    }

    // Folder picker is owned by a headless framework Fragment, leaving MainActivity untouched.
    private void pickFolder() { pickDocuments(true); }
    private void pickDocuments(boolean tree) {
        if (a.getFragmentManager().findFragmentByTag("drive-tree-picker") != null) return;
        FolderPicker picker = new FolderPicker(); picker.owner = this;
        Bundle args = new Bundle(); args.putBoolean("tree", tree); picker.setArguments(args);
        a.getFragmentManager().beginTransaction().add(picker, "drive-tree-picker").commit();
    }
    public static final class FolderPicker extends Fragment {
        DriveScreen owner;
        @Override public void onCreate(Bundle state) {
            super.onCreate(state);
            if (state != null || owner == null) { remove(); return; }
            boolean tree = getArguments() != null && getArguments().getBoolean("tree");
            Intent intent = new Intent(tree ? Intent.ACTION_OPEN_DOCUMENT_TREE : Intent.ACTION_OPEN_DOCUMENT);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (tree) intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
            else { intent.setType("*/*"); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true); }
            try { startActivityForResult(intent, 7104); } catch (Exception e) { owner.a.toast("Dosya seçici açılamadı: " + message(e)); remove(); }
        }
        @Override public void onActivityResult(int request, int result, Intent data) {
            super.onActivityResult(request, result, data);
            if (request == 7104 && result == Activity.RESULT_OK && data != null && owner != null && owner.alive(owner.body)) {
                boolean tree = getArguments() != null && getArguments().getBoolean("tree");
                if (tree && data.getData() != null) owner.uploadTree(data.getData());
                else if (!tree) {
                    List<Uri> files = new ArrayList<>();
                    if (data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) files.add(data.getClipData().getItemAt(i).getUri());
                    else if (data.getData() != null) files.add(data.getData());
                    if (!files.isEmpty()) owner.uploadFiles(files);
                }
            }
            remove();
        }
        private void remove() { if (getFragmentManager() != null) getFragmentManager().beginTransaction().remove(this).commitAllowingStateLoss(); }
    }
    private static final class Transfer {
        volatile boolean cancelled;
        volatile HttpURLConnection connection;
        int files, folders;
        ProgressDialog dialog;
        void check() throws IOException { if (cancelled || Thread.currentThread().isInterrupted()) throw new IOException("İşlem durduruldu. Tamamlanan dosyalar korunur."); }
        void cancel() { cancelled = true; HttpURLConnection c = connection; if (c != null) IO.execute(c::disconnect); }
    }
    private interface TransferWork { void run(Transfer transfer) throws Exception; }
    private void transfer(String title, TransferWork work) {
        if (busy) return; busy = true; Transfer t = new Transfer(); final LinearLayout page = body;
        t.dialog = new ProgressDialog(dialogContext()); t.dialog.setTitle(title); t.dialog.setMessage("Hazırlanıyor…"); t.dialog.setCancelable(false);
        t.dialog.setButton(AlertDialog.BUTTON_NEGATIVE, "Durdur", (d, w) -> t.cancel());
        activeTransfer = t; showDialog(t.dialog);
        // Do not dismiss until the worker has stopped; cancellation can leave completed items.
        t.dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v -> { t.cancel(); t.dialog.setMessage("Durduruluyor…"); });
        IO.execute(() -> {
            String error = ""; try { t.check(); work.run(t); } catch (Exception e) { error = message(e); }
            final String report = t.files + " dosya, " + t.folders + " klasör tamamlandı." + (error.isEmpty() ? "" : "\n" + error + "\nTamamlanan öğeler sunucuda korunur; yeniden denemeden önce hedefi kontrol et.");
            MAIN.post(() -> {
                busy = false; if (activeTransfer == t) activeTransfer = null; if (t.dialog.isShowing()) t.dialog.dismiss(); if (!alive(page)) return;
                load(); showDialog(new AlertDialog.Builder(dialogContext()).setTitle(title).setMessage(report).setPositiveButton("Tamam", null).create());
            });
        });
    }
    private void progress(Transfer t, String name, long bytes) {
        MAIN.post(() -> { if (!a.isDestroyed() && t.dialog.isShowing() && !t.cancelled) t.dialog.setMessage(name + "\n" + a.bytes(bytes) + " · " + t.files + " dosya tamamlandı"); });
    }
    private void uploadTree(Uri tree) {
        String target = parent;
        transfer("Klasör yükleme", t -> {
            Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            uploadDocument(tree, root, target, t, 0);
        });
    }
    private void uploadFiles(List<Uri> files) {
        uploadFiles(files, parent, () -> {});
    }
    private void uploadFiles(List<Uri> files, String target, Runnable release) {
        transfer("Dosya yükleme", t -> {
            try {
            for (Uri uri : files) {
                t.check(); String name = "dosya"; long size = -1;
                try (Cursor cursor = a.getContentResolver().query(uri, new String[]{android.provider.OpenableColumns.DISPLAY_NAME, android.provider.OpenableColumns.SIZE}, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) { name = cursor.getString(0); if (!cursor.isNull(1)) size = cursor.getLong(1); }
                }
                try (InputStream input = a.getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IOException("Dosya okunamadı: " + name);
                    uploadStream(input, name, a.getContentResolver().getType(uri), size, target, t); t.files++;
                }
            }
            } finally { release.run(); }
        });
    }
    private void uploadDocument(Uri tree, Uri document, String target, Transfer t, int depth) throws Exception {
        t.check(); if (depth > 100) throw new IOException("Klasör yapısı çok derin (100 seviye).");
        String name, mime; long size;
        try (Cursor c = a.getContentResolver().query(document, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE}, null, null, null)) {
            if (c == null || !c.moveToFirst()) throw new IOException("Seçilen belge okunamadı.");
            name = c.getString(0); mime = c.getString(1); size = c.isNull(2) ? -1 : c.getLong(2);
        }
        if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
            String destination = ensureFolder(name, target); t.folders++;
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(document));
            List<String> ids = new ArrayList<>();
            try (Cursor c = a.getContentResolver().query(children, new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID}, null, null, null)) {
                if (c == null) throw new IOException("Klasör içeriği okunamadı: " + name);
                while (c.moveToNext()) ids.add(c.getString(0));
            }
            for (String id : ids) uploadDocument(tree, DocumentsContract.buildDocumentUriUsingTree(tree, id), destination, t, depth + 1);
        } else {
            try (InputStream input = a.getContentResolver().openInputStream(document)) {
                if (input == null) throw new IOException("Dosya okunamadı: " + name);
                uploadStream(input, name, mime, size, target, t); t.files++;
            }
        }
    }
    private String ensureFolder(String name, String target) throws Exception {
        JSONObject data = request("GET", "/items" + parentQuery(target), null); JSONArray children = data.optJSONArray("items");
        if (children != null) for (int i = 0; i < children.length(); i++) {
            JSONObject child = children.optJSONObject(i); if (child != null && child.optString("name").equals(name)) {
                if (!folder(child)) throw new IOException("Aynı isimli dosya klasör oluşturmayı engelliyor: " + name);
                return child.optString("id");
            }
        }
        return request("POST", "/folders", a.obj("name", name, "parent", nullable(target))).getString("id");
    }
    private void copy(List<JSONObject> rows, String target) {
        List<JSONObject> snapshot = new ArrayList<>(rows);
        transfer("Kopyalama", t -> {
            JSONArray folders = requestArray("/folders"); Map<String, JSONObject> map = new HashMap<>();
            for (int i = 0; i < folders.length(); i++) { JSONObject f = folders.optJSONObject(i); if (f != null) map.put(f.optString("id"), f); }
            if (forbidden(target, snapshot, map)) throw new IOException("Klasör kendisine veya alt klasörüne kopyalanamaz.");
            Set<String> ids = new HashSet<>(); for (JSONObject r : snapshot) ids.add(r.optString("id"));
            for (JSONObject row : snapshot) {
                boolean nested = false; String at = nullString(row, "parent"); Set<String> seen = new HashSet<>();
                while (at != null && seen.add(at)) { if (ids.contains(at)) { nested = true; break; } JSONObject f = map.get(at); at = f == null ? null : nullString(f, "parent"); }
                if (!nested) copyItem(row, target, t, 0);
            }
        });
    }
    private void copyItem(JSONObject source, String target, Transfer t, int depth) throws Exception {
        t.check(); if (depth > 100) throw new IOException("Klasör yapısı çok derin (100 seviye).");
        if (folder(source)) {
            // New folders get a unique name, so a copy never silently merges into an existing tree.
            String name = source.optString("name"); Set<String> names = new HashSet<>();
            JSONArray siblings = request("GET", "/items" + parentQuery(target), null).getJSONArray("items");
            for (int i = 0; i < siblings.length(); i++) names.add(siblings.getJSONObject(i).optString("name"));
            String unique = name; int n = 1;
            while (names.contains(unique)) { String suffix = " (" + n++ + ")"; unique = name.substring(0, Math.min(name.length(), 200 - suffix.length())) + suffix; }
            String id = request("POST", "/folders", a.obj("name", unique, "parent", nullable(target))).getString("id"); t.folders++;
            JSONArray children = request("GET", "/items" + parentQuery(source.optString("id")), null).getJSONArray("items");
            for (int i = 0; i < children.length(); i++) copyItem(children.getJSONObject(i), id, t, depth + 1);
        } else {
            HttpURLConnection c = connection(itemPath(source) + "/content", "GET");
            try {
                if (c.getResponseCode() != 200) { response(c); throw new IOException("Dosya okunamadı."); }
                try (InputStream in = c.getInputStream()) { uploadStream(in, source.optString("name"), mime(source), source.optLong("size"), target, t); t.files++; }
            } finally { c.disconnect(); }
        }
    }
    private void uploadStream(InputStream in, String name, String mime, long size, String target, Transfer t) throws Exception {
        t.check(); if (!validName(name)) throw new IOException("Geçersiz dosya adı: " + name);
        if (size > 10L * 1024 * 1024 * 1024) throw new IOException("Tek dosya en fazla 10 GB olabilir: " + name);
        String boundary = "KeremDrive" + java.util.UUID.randomUUID().toString().replace("-", "");
        HttpURLConnection c = connection("/upload" + parentQuery(target), "POST"); t.connection = c;
        try {
            c.setReadTimeout(120000); c.setDoOutput(true); c.setChunkedStreamingMode(65536);
            c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            String safeMime = mime != null && mime.matches("[a-zA-Z0-9!#$&^_.+/-]+") ? mime : "application/octet-stream";
            // Busboy uses UTF-8 filenames, matching the inspected server's defParamCharset.
            String header = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + name.replace("\"", "\\\"") + "\"\r\nContent-Type: " + safeMime + "\r\n\r\n";
            try (OutputStream out = c.getOutputStream()) {
                out.write(header.getBytes(StandardCharsets.UTF_8)); byte[] buffer = new byte[65536]; long sent = 0, last = 0; int n;
                while ((n = in.read(buffer)) != -1) {
                    t.check(); sent += n; if (sent > 10L * 1024 * 1024 * 1024) throw new IOException("Tek dosya en fazla 10 GB olabilir.");
                    out.write(buffer, 0, n); long now = System.currentTimeMillis(); if (now - last > 250) { progress(t, name, sent); last = now; }
                }
                out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            }
            response(c);
        } finally { t.connection = null; c.disconnect(); }
    }

    private void open(JSONObject item) {
        if (trash()) { itemMenu(item); return; }
        if (folder(item)) { navigate(item.optString("id"), 0); return; }
        a.navigate(() -> preview(item));
    }
    private void preview(JSONObject item) {
        ++loadId; theme(); wide = a.getResources().getConfiguration().screenWidthDp > 520;
        body = a.page(item.optString("name"), ""); a.remember(() -> preview(item)); bindLifecycle(body, () -> preview(item));
        LinearLayout previewHeader = Ui.fixedHeader(a); previewHeader.setBackgroundColor(a.surface); previewHeader.setPadding(a.dp(12), a.dp(8), a.dp(8), a.dp(8));
        LinearLayout heading = a.row(); previewHeader.addView(heading, new LinearLayout.LayoutParams(-1, a.dp(48)));
        heading.addView(new FileArt(item), new LinearLayout.LayoutParams(a.dp(34), a.dp(34)));
        TextView name = text(item.optString("name"), wide ? 13 : 11, a.ink, 600); name.setSingleLine(true); name.setEllipsize(android.text.TextUtils.TruncateAt.END); name.setPadding(a.dp(10), 0, a.dp(8), 0);
        heading.addView(name, new LinearLayout.LayoutParams(0, -2, 1)); heading.addView(glyph("close", "Önizlemeyi kapat", 44, a.muted, a::back)); Ui.line(a, previewHeader, lineColor());
        body.setPadding(a.dp(wide ? 24 : 12), a.dp(10), a.dp(wide ? 24 : 12), a.dp(20));
        LinearLayout buttons = horizontal(body);
        action(buttons, "İndir", () -> a.download(content(item, false), item.optString("name"), mime(item)));
        action(buttons, "Paylaş", () -> a.share(content(item, false), mime(item)));
        action(buttons, "Uygulamada aç", () -> a.openFile(content(item, true), item.optString("name"), mime(item)));
        action(buttons, "Özellikler", () -> properties(item));
        List<JSONObject> files = new ArrayList<>(); for (JSONObject row : visible()) if (!folder(row)) files.add(row);
        int index = -1; for (int i = 0; i < files.size(); i++) if (files.get(i).optString("id").equals(item.optString("id"))) index = i;
        LinearLayout nav = horizontal(body);
        if (index > 0) { JSONObject previous = files.get(index - 1); action(nav, "‹ Önceki", () -> preview(previous)); }
        if (index >= 0 && index < files.size() - 1) { JSONObject next = files.get(index + 1); action(nav, "Sonraki ›", () -> preview(next)); }
        a.note(body, label(item) + " · " + a.bytes(item.optDouble("size")) + " · " + date(item.optString("updated")));
        String kind = kind(item);
        if (kind.equals("image")) {
            a.image(body, content(item, true), Math.max(160, Math.min(420, a.getResources().getConfiguration().screenHeightDp - 230)), () -> a.photo(content(item, true), item.optString("name")));
            action(body, "Tam ekran / yakınlaştır", () -> a.photo(content(item, true), item.optString("name")));
        } else if (kind.equals("pdf")) {
            a.note(body, "PDF’yi yerel okuyucuda aç; sayfa ve yakınlaştırma kontrollerini kullan.");
            action(body, "PDF’yi oku", () -> a.openFile(content(item, true), item.optString("name"), "application/pdf"));
        } else if (kind.equals("video") || kind.equals("audio")) {
            a.note(body, "Yerel oynatıcıda oynat, duraklat ve ileri/geri sar.");
            action(body, kind.equals("audio") ? "♫ Dinle" : "▶ Oynat", () -> a.openFile(content(item, true), item.optString("name"), mime(item)));
        } else if (kind.equals("text") || kind.equals("docx") || kind.equals("xlsx")) document(item, kind);
        else a.note(body, "Bu biçimin yerel önizlemesi yok. İndirip uygun uygulamada açabilirsin.");
    }
    private void document(JSONObject item, String kind) {
        LinearLayout area = a.card(body); a.note(area, "Belge hazırlanıyor…");
        int limit = kind.equals("text") ? 2 * 1024 * 1024 : 25 * 1024 * 1024;
        if (item.optLong("size") > limit) { area.removeAllViews(); a.note(area, "Önizleme sınırı " + a.bytes(limit) + ". Dosyayı indirip uygulamada açabilirsin."); return; }
        async(() -> {
            HttpURLConnection c = connection(itemPath(item) + "/content", "GET"); byte[] bytes;
            try { if (c.getResponseCode() != 200) { response(c); throw new IOException("Belge okunamadı."); } bytes = readLimited(c.getInputStream(), limit); } finally { c.disconnect(); }
            if (kind.equals("text")) return (Object) decodeText(bytes);
            File file = File.createTempFile("drive-preview-", ".zip", a.getCacheDir());
            try {
                try (FileOutputStream out = new FileOutputStream(file)) { out.write(bytes); }
                try (ZipFile zip = new ZipFile(file)) { return kind.equals("docx") ? word(zip, Math.max(100, a.getResources().getDisplayMetrics().widthPixels - a.dp(90))) : workbook(zip); }
            } finally { file.delete(); }
        }, result -> {
            area.removeAllViews();
            if (result instanceof Workbook) showWorkbook(area, (Workbook) result);
            else {
                TextView text = a.text("", kind.equals("text") ? 13 : 16, a.ink); text.setText((CharSequence) result); text.setTextIsSelectable(true);
                if (kind.equals("docx")) text.setMovementMethod(android.text.method.LinkMovementMethod.getInstance());
                if (kind.equals("text")) text.setTypeface(Typeface.MONOSPACE);
                text.setLineSpacing(a.dp(4), 1); area.addView(text);
                if (kind.equals("docx")) a.note(area, "Okuma görünümü · Metin, başlık ve tablolar. Özgün sayfa düzeni ve gömülü nesneler için uygulamada aç.");
            }
        }, error -> { area.removeAllViews(); a.note(area, "Önizleme açılamadı: " + error); action(area, "Yeniden dene", () -> preview(item)); }, body);
    }
    private static String decodeText(byte[] bytes) {
        if (bytes.length >= 2 && (bytes[0] & 255) == 255 && (bytes[1] & 255) == 254) return new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16LE);
        if (bytes.length >= 2 && (bytes[0] & 255) == 254 && (bytes[1] & 255) == 255) return new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16BE);
        String text = new String(bytes, StandardCharsets.UTF_8); return text.startsWith("\ufeff") ? text.substring(1) : text;
    }
    private static XmlPullParser xml(ZipFile zip, String entry) throws Exception {
        ZipEntry e = zip.getEntry(entry); if (e == null) throw new IOException("Belge bölümü eksik: " + entry);
        // Bound every expanded XML part, including ZIP bombs; external entities are never resolved.
        byte[] bytes = readLimited(zip.getInputStream(e), 32 * 1024 * 1024);
        XmlPullParserFactory factory = XmlPullParserFactory.newInstance(); factory.setNamespaceAware(true);
        XmlPullParser p = factory.newPullParser(); p.setInput(new java.io.ByteArrayInputStream(bytes), null); return p;
    }
    private static int next(XmlPullParser p) throws Exception {
        int event = p.next(); if (event == XmlPullParser.DOCDECL || event == XmlPullParser.ENTITY_REF) throw new IOException("Desteklenmeyen XML bildirimi."); return event;
    }
    private static String attr(XmlPullParser p, String name) {
        for (int i = 0; i < p.getAttributeCount(); i++) if (name.equals(p.getAttributeName(i))) return p.getAttributeValue(i); return "";
    }
    private static CharSequence word(ZipFile zip, int imageWidth) throws Exception {
        Map<String, String> relationships = new HashMap<>();
        if (zip.getEntry("word/_rels/document.xml.rels") != null) {
            XmlPullParser rel = xml(zip, "word/_rels/document.xml.rels"); int event;
            while ((event = next(rel)) != XmlPullParser.END_DOCUMENT) if (event == XmlPullParser.START_TAG && "Relationship".equals(rel.getName())) {
                String target = attr(rel, "Target");
                if (!attr(rel, "TargetMode").equals("External")) target = target.startsWith("/") ? target.substring(1) : java.net.URI.create("word/").resolve(target).normalize().getPath();
                relationships.put(attr(rel, "Id"), target);
            }
        }
        XmlPullParser p = xml(zip, "word/document.xml"); SpannableStringBuilder out = new SpannableStringBuilder();
        int event, start = 0, paragraphStart = 0, heading = 0, linkStart = 0, images = 0; String link = "";
        boolean bold = false, italic = false, inText = false;
        while ((event = next(p)) != XmlPullParser.END_DOCUMENT) {
            String tag = p.getName();
            if (event == XmlPullParser.START_TAG) {
                if ("p".equals(tag)) { paragraphStart = out.length(); heading = 0; }
                if ("numPr".equals(tag)) out.append("• ");
                if ("hyperlink".equals(tag)) { linkStart = out.length(); link = relationships.getOrDefault(attr(p, "id"), ""); }
                if ("blip".equals(tag)) {
                    String path = relationships.get(attr(p, "embed")); ZipEntry entry = path == null ? null : zip.getEntry(path);
                    if (entry != null && images++ < 12) {
                        byte[] bytes = readLimited(zip.getInputStream(entry), 16 * 1024 * 1024);
                        android.graphics.BitmapFactory.Options options = new android.graphics.BitmapFactory.Options(); options.inJustDecodeBounds = true;
                        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                        options.inSampleSize = 1;
                        while (Math.max(options.outWidth, options.outHeight) / options.inSampleSize > 900) options.inSampleSize *= 2;
                        options.inJustDecodeBounds = false;
                        android.graphics.Bitmap bitmap = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                        if (bitmap != null) {
                            android.graphics.drawable.BitmapDrawable drawable = new android.graphics.drawable.BitmapDrawable(null, bitmap);
                            int width = Math.min(imageWidth, bitmap.getWidth()); int height = Math.max(1, (int) (bitmap.getHeight() * (width / (double) bitmap.getWidth())));
                            drawable.setBounds(0, 0, width, height); int at = out.length(); out.append("\n\ufffc\n");
                            out.setSpan(new ImageSpan(drawable), at + 1, at + 2, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                        } else out.append("[Gömülü görsel uygulamada açılabilir]");
                    } else out.append("[Gömülü görsel uygulamada açılabilir]");
                }
                if ("pStyle".equals(tag)) {
                    String style = attr(p, "val").toLowerCase(Locale.ROOT);
                    if (style.startsWith("heading")) heading = intOr(style.replaceAll("[^0-9]", ""), 1);
                    else if (style.equals("title")) heading = 1;
                }
                if ("r".equals(tag)) { start = out.length(); bold = italic = false; }
                if ("b".equals(tag)) bold = !Arrays.asList("0", "false", "off").contains(attr(p, "val"));
                if ("i".equals(tag)) italic = !Arrays.asList("0", "false", "off").contains(attr(p, "val"));
                if ("t".equals(tag)) inText = true;
                if ("tab".equals(tag)) out.append('\t'); if ("br".equals(tag) || "cr".equals(tag)) out.append('\n');
            } else if (event == XmlPullParser.TEXT && inText) out.append(p.getText());
            else if (event == XmlPullParser.END_TAG) {
                if ("t".equals(tag)) inText = false;
                if ("hyperlink".equals(tag) && out.length() > linkStart && (link.startsWith("https://") || link.startsWith("http://"))) out.setSpan(new URLSpan(link), linkStart, out.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                if ("r".equals(tag) && out.length() > start && (bold || italic)) out.setSpan(new StyleSpan(bold && italic ? Typeface.BOLD_ITALIC : bold ? Typeface.BOLD : Typeface.ITALIC), start, out.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                if ("p".equals(tag)) {
                    if (heading > 0 && out.length() > paragraphStart) {
                        out.setSpan(new StyleSpan(Typeface.BOLD), paragraphStart, out.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                        out.setSpan(new RelativeSizeSpan(heading == 1 ? 1.6f : heading == 2 ? 1.35f : 1.15f), paragraphStart, out.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    }
                    out.append('\n');
                }
                if ("tc".equals(tag)) out.append("  │  "); if ("tr".equals(tag)) out.append('\n');
            }
            if (out.length() > 2 * 1024 * 1024) throw new IOException("Belge metni önizleme sınırını aşıyor.");
        }
        return out.length() == 0 ? "(Boş belge)" : out;
    }
    private static final class Sheet { String name, path; final List<List<String>> rows = new ArrayList<>(); }
    private static final class Workbook { final List<Sheet> sheets = new ArrayList<>(); }
    private static List<String> dateStyles(ZipFile zip) throws Exception {
        List<String> styles = new ArrayList<>();
        if (zip.getEntry("xl/styles.xml") == null) return styles;
        Map<Integer, String> formats = new HashMap<>();
        XmlPullParser p = xml(zip, "xl/styles.xml"); int event; boolean cellFormats = false;
        while ((event = next(p)) != XmlPullParser.END_DOCUMENT) {
            String tag = p.getName();
            if (event == XmlPullParser.START_TAG) {
                if ("numFmt".equals(tag)) formats.put(intOr(attr(p, "numFmtId"), 0), attr(p, "formatCode"));
                if ("cellXfs".equals(tag)) cellFormats = true;
                if ("xf".equals(tag) && cellFormats) {
                    int id = intOr(attr(p, "numFmtId"), 0);
                    String code = formats.getOrDefault(id, "").toLowerCase(Locale.ROOT).replaceAll("\"[^\"]*\"|\\\\.|\\[[^\\]]*\\]", "");
                    boolean date = (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58) || code.matches(".*[ydhs].*") || code.contains("mm");
                    boolean time = (id >= 18 && id <= 22) || (id >= 45 && id <= 47) || code.matches(".*[hs].*");
                    styles.add(date ? time ? "datetime" : "date" : "");
                }
            } else if (event == XmlPullParser.END_TAG && "cellXfs".equals(tag)) cellFormats = false;
        }
        return styles;
    }
    private static String excelDate(String value, boolean date1904, boolean time) {
        try {
            double serial = Double.parseDouble(value);
            if (!Double.isFinite(serial) || serial < 0 || serial > 2958465) return value;
            long days = (long) Math.floor(serial), seconds = Math.round((serial - days) * 86400);
            java.time.LocalDate origin = date1904 ? java.time.LocalDate.of(1904, 1, 1) : java.time.LocalDate.of(1899, 12, 31);
            if (!date1904 && days >= 60) days--; // Excel's fictitious 1900-02-29.
            java.time.LocalDateTime date = origin.plusDays(days).atStartOfDay().plusSeconds(seconds);
            return DateTimeFormatter.ofPattern(time ? "d.MM.yyyy HH:mm:ss" : "d.MM.yyyy", TR).format(date);
        } catch (Exception e) { return value; }
    }
    private static Workbook workbook(ZipFile zip) throws Exception {
        Workbook book = new Workbook(); Map<String, String> relationships = new HashMap<>();
        XmlPullParser p = xml(zip, "xl/_rels/workbook.xml.rels"); int event;
        while ((event = next(p)) != XmlPullParser.END_DOCUMENT) if (event == XmlPullParser.START_TAG && "Relationship".equals(p.getName()) && !attr(p, "TargetMode").equals("External")) {
            String path = attr(p, "Target");
            path = path.startsWith("/") ? path.substring(1) : java.net.URI.create("xl/").resolve(path).normalize().getPath();
            relationships.put(attr(p, "Id"), path);
        }
        p = xml(zip, "xl/workbook.xml"); boolean date1904 = false;
        while ((event = next(p)) != XmlPullParser.END_DOCUMENT) if (event == XmlPullParser.START_TAG) {
            if ("workbookPr".equals(p.getName())) date1904 = Arrays.asList("1", "true").contains(attr(p, "date1904"));
            if ("sheet".equals(p.getName())) {
                if (book.sheets.size() >= 200) throw new IOException("Çalışma kitabı 200 sayfadan büyük.");
                Sheet s = new Sheet(); s.name = attr(p, "name"); s.path = relationships.get(attr(p, "id")); if (s.path != null) book.sheets.add(s);
            }
        }
        List<String> dateStyles = dateStyles(zip);
        List<String> strings = new ArrayList<>();
        if (zip.getEntry("xl/sharedStrings.xml") != null) {
            p = xml(zip, "xl/sharedStrings.xml"); StringBuilder value = null; boolean text = false;
            while ((event = next(p)) != XmlPullParser.END_DOCUMENT) {
                if (event == XmlPullParser.START_TAG) { if ("si".equals(p.getName())) value = new StringBuilder(); if ("t".equals(p.getName())) text = true; }
                if (event == XmlPullParser.TEXT && text && value != null) value.append(p.getText());
                if (event == XmlPullParser.END_TAG) {
                    if ("t".equals(p.getName())) text = false;
                    if ("si".equals(p.getName()) && value != null) { strings.add(value.toString()); value = null; }
                }
                if (strings.size() > 200000) throw new IOException("Paylaşılan metin tablosu çok büyük.");
            }
        }
        int cells = 0, characters = 0;
        for (Sheet sheet : book.sheets) {
            p = xml(zip, sheet.path); List<String> row = null; String type = "", value = ""; int column = 0, number = 0, style = 0; boolean read = false; StringBuilder cellText = new StringBuilder();
            while ((event = next(p)) != XmlPullParser.END_DOCUMENT) {
                String tag = p.getName();
                if (event == XmlPullParser.START_TAG) {
                    if ("row".equals(tag)) { number = intOr(attr(p, "r"), number + 1); if (number > 1000) break; row = new ArrayList<>(); column = 0; }
                    if ("c".equals(tag)) { type = attr(p, "t"); style = intOr(attr(p, "s"), 0); String ref = attr(p, "r"); int col = 0; for (char ch : ref.toCharArray()) { if (ch < 'A' || ch > 'Z') break; col = col * 26 + ch - 'A' + 1; } if (col > 0) column = col - 1; value = ""; cellText.setLength(0); }
                    if ("v".equals(tag) || "t".equals(tag)) read = true;
                } else if (event == XmlPullParser.TEXT && read) cellText.append(p.getText());
                else if (event == XmlPullParser.END_TAG) {
                    if ("v".equals(tag) || "t".equals(tag)) { read = false; value = cellText.toString(); }
                    if ("c".equals(tag) && row != null && column < 50) {
                        while (row.size() <= column) row.add("");
                        if (type.equals("s")) { int at = intOr(value, -1); value = at >= 0 && at < strings.size() ? strings.get(at) : ""; }
                        if (type.equals("b")) value = value.equals("1") ? "TRUE" : "FALSE";
                        if ((type.isEmpty() || type.equals("n")) && style < dateStyles.size() && !dateStyles.get(style).isEmpty()) value = excelDate(value, date1904, dateStyles.get(style).equals("datetime"));
                        if (value.length() > 10000) value = value.substring(0, 10000) + "…";
                        characters += value.length(); if (characters > 4 * 1024 * 1024) throw new IOException("Çalışma kitabındaki metin önizleme sınırını aşıyor.");
                        row.set(column, value); column++; if (++cells > 100000) throw new IOException("Çalışma kitabı önizleme sınırını aşıyor. Uygulamada aç.");
                    }
                    if ("row".equals(tag) && row != null) { while (sheet.rows.size() < number - 1) sheet.rows.add(new ArrayList<>()); sheet.rows.add(row); row = null; }
                }
            }
        }
        return book;
    }
    private static int intOr(String text, int fallback) { try { return Integer.parseInt(text); } catch (Exception e) { return fallback; } }
    private void showWorkbook(LinearLayout area, Workbook book) {
        if (book.sheets.isEmpty()) { a.note(area, "Bu çalışma kitabı boş."); return; }
        LinearLayout content = a.column();
        String[] names = new String[book.sheets.size()]; for (int i = 0; i < names.length; i++) names[i] = book.sheets.get(i).name;
        action(area, "Çalışma sayfası seç", () -> choose("Sayfa", names, i -> showSheet(content, book.sheets.get(i))));
        a.note(area, "En fazla 1.000 satır / 50 sütun. Formüllerin kaydedilmiş sonuçları gösterilir; biçim ve grafikler için uygulamada aç.");
        area.addView(content); showSheet(content, book.sheets.get(0));
    }
    private void showSheet(LinearLayout into, Sheet sheet) {
        into.removeAllViews(); a.heading(into, sheet.name);
        if (sheet.rows.isEmpty()) { a.note(into, "Bu sayfa boş."); return; }
        int columns = 0; for (List<String> row : sheet.rows) columns = Math.max(columns, row.size());
        HorizontalScrollView horizontal = new HorizontalScrollView(a); LinearLayout table = a.column();
        horizontal.addView(table); into.addView(horizontal, new LinearLayout.LayoutParams(-1, a.dp(450)));
        LinearLayout header = a.row(); table.addView(header); cell(header, "#", true, 55);
        for (int i = 0; i < columns; i++) cell(header, i < 26 ? String.valueOf((char) ('A' + i)) : "A" + (char) ('A' + i - 26), true, 130);
        // Recycle rows through ListView instead of allocating up to 50,000 TextViews.
        android.widget.ListView rows = new android.widget.ListView(a); rows.setDividerHeight(a.dp(1));
        final int width = columns;
        rows.setAdapter(new android.widget.BaseAdapter() {
            public int getCount() { return sheet.rows.size(); }
            public Object getItem(int position) { return sheet.rows.get(position); }
            public long getItemId(int position) { return position; }
            public View getView(int position, View convert, android.view.ViewGroup parent) {
                LinearLayout row = convert instanceof LinearLayout ? (LinearLayout) convert : a.row(); row.removeAllViews();
                cell(row, String.valueOf(position + 1), true, 55); List<String> values = sheet.rows.get(position);
                for (int c = 0; c < width; c++) cell(row, c < values.size() ? values.get(c) : "", false, 130); return row;
            }
        });
        // A fixed-height list provides bounded native recycling inside the horizontal viewport.
        table.addView(rows, new LinearLayout.LayoutParams(a.dp(55 + 130 * columns), a.dp(390)));
    }
    private void cell(LinearLayout row, String value, boolean header, int width) {
        TextView cell = a.text(value, 12, header ? a.muted : a.ink); cell.setPadding(a.dp(8), a.dp(10), a.dp(8), a.dp(10));
        cell.setMaxLines(8); cell.setMinHeight(a.dp(42)); if (header) cell.setTypeface(null, Typeface.BOLD);
        row.addView(cell, new LinearLayout.LayoutParams(a.dp(width), -2));
    }
}

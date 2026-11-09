# Keremhub Android implementation contract

Native Android Java, package `com.keremhub.app`, source under `app/src/main/java/com/keremhub/app`. No WebView app shell. SDK platform widgets and custom styling. Min API 26, target 35. Preserve source service colors and information architecture. Main activity provides shared helpers below. Modules own only their named Java file, avoid touching common infrastructure.

`public final class FlixScreen/DriveScreen/BooksScreen/GalleryScreen { public static void show(MainActivity a); }`

MainActivity contract:
- `public int bg, surface, ink, muted, accent;` theme colors; `theme(int bg,int surface,int ink,int muted,int accent)`.
- `LinearLayout page(String title, String subtitle)` resets content, creates app toolbar with back/home, vertically scrolling padded body; returns body. Page does NOT reset theme. Navigation via `a.navigate(() -> show(a))` pushes current screen; `a.back()`.
- `void remember(Runnable reload)` sets current screen reloader after page(); used by navigation and retry.
- `TextView text(String text,int sp,int color)`; `TextView heading(LinearLayout parent,String text)`; `void note(LinearLayout parent,String text)`.
- `LinearLayout column()`; `LinearLayout row()`; `void space(LinearLayout parent,int dp)`; `int dp(float n)`.
- `android.graphics.drawable.GradientDrawable shape(int color,int radius)`; `LinearLayout card(LinearLayout parent)` padded rounded card adds to parent; `TextView button(LinearLayout parent,String label,Runnable click)` adds touch button; `void chips(LinearLayout parent,String[] labels,int selected,java.util.function.IntConsumer click)` horizontal scroll chips.
- `void image(LinearLayout parent,String url,int heightDp,Runnable click)` full width image with cache, fit center crop. `void posterRow(LinearLayout parent,JSONArray items,java.util.function.Consumer<JSONObject> click)` horizontal cards generic title/name, posterUrl/coverUrl/thumbUrl, optional subtitle/author; 124dp wide.
- `void search(LinearLayout parent,String hint,java.util.function.Consumer<String> submit)` native input and submit.
- `void get(String path,java.util.function.Consumer<JSONObject> done)` async object JSON; `void getArray(String path,java.util.function.Consumer<JSONArray> done)`; `void request(String method,String path,JSONObject body,java.util.function.Consumer<JSONObject> done)`; failures visible toast/banner, no fake success. All callbacks main UI thread, dropped on page change. For DELETE responses empty accepted.
- `void confirm(String title,String message,Runnable yes)`; `void prompt(String title,String initial,java.util.function.Consumer<String> answer)`; `void choose(String title,String[] options,java.util.function.IntConsumer selected)`.
- `void form(String title,String[] labels,String[] values,java.util.function.Consumer<String[]> done)` dialog string inputs.
- `JSONObject obj(Object... keyValuePairs)` convenience JSON builder; `String enc(String value)` URL encoder; `String bytes(double n)`.
- `void download(String path,String filename,String mime)` Android DownloadManager; `void share(String path,String mime)` downloads to cache and ACTION_SEND FileProvider; `void openFile(String path,String name,String mime)` native PDF/text/image/video handling or cached file ACTION_VIEW; `void photo(String path,String title)` full screen zoom image native.
- `void upload(String path,String field,JSONObject formFields,String mime,boolean multiple,Runnable done)` Storage Access Framework picker then multipart streaming. Avoid requesting broad storage permission.
- `void play(String stream,String title,double startSeconds,String progressPath,int episodeId,Runnable next)` native video; progress POST {episodeId,seconds,duration} every 10 secs and on stop; next optional. Native controls, speed/seek/PiP.
- `void readBook(JSONObject book)` receives detail payload from book detail API; uses native PDF and EPUB reader.
- `void external(String url)` only for custom portal links; existing four services must native.
- `String base()` configured server URL default http://192.168.1.240; `void toast(String message)`.

Each module should implement ALL service features exposed by the existing code and APIs with native lists/forms/dialogs and meaningful error/empty states. Use actual request schemas by reading sources. Do not modify live server or mutate user data during testing. Source reference `inspection/` read only. Use Java 17 compatible syntax. No dependencies. Return exact feature limitations if something cannot be implemented.

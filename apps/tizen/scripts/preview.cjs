process.env.KEREMFLIX_PREVIEW_BACKEND = "http://192.168.1.240:3210";
require("../server/bridge.cjs")
  .createServer()
  .listen(3211, "127.0.0.1", () =>
    console.log("Keremflix v2 preview: http://127.0.0.1:3211"),
  );

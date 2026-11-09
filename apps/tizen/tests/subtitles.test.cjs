const test = require("node:test");
const assert = require("node:assert/strict");
const { createSubtitleService } = require("../server/subtitles.cjs");
test("embedded subtitle conversion lists text streams, preserves languages and caches concurrent extraction", async () => {
  const calls = [];
  const run = async (command, args) => {
    calls.push({ command, args });
    return {
      stdout:
        command === "ffprobe"
          ? JSON.stringify({
              streams: [
                {
                  index: 3,
                  codec_name: "mov_text",
                  tags: { language: "tur" },
                  disposition: { forced: 1 },
                },
                {
                  index: 4,
                  codec_name: "hdmv_pgs_subtitle",
                  tags: { language: "eng" },
                },
                {
                  index: 5,
                  codec_name: "ass",
                  tags: { language: "eng", title: "English" },
                },
              ],
            })
          : "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello",
    };
  };
  const service = createSubtitleService(
    new URL("http://localhost:3200/keremflix/"),
    run,
  );
  const tracks = await service.tracks("5539");
  assert.deepEqual(
    tracks.map((t) => t.index),
    [3, 5],
  );
  assert.equal(JSON.parse(tracks[0].extra_info).track_lang, "tur");
  assert.equal(JSON.parse(tracks[0].extra_info).forced, true);
  const result = await Promise.all([
    service.text("5539", "5"),
    service.text("5539", "5"),
  ]);
  assert.equal(result[0], result[1]);
  assert.equal(calls.filter((c) => c.command === "ffmpeg").length, 1);
  assert(calls[1].args.includes("0:5"));
  assert(
    calls[1].args.includes("http://localhost:3200/keremflix/api/stream/5539"),
  );
  await assert.rejects(service.text("5539", "4"));
  await assert.rejects(service.text("5539", "5;evil"));
  await assert.rejects(service.tracks("../private"));
  assert.equal(calls.length, 2);
});

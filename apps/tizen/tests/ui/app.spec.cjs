const { test, expect } = require("@playwright/test");
const title = (id, kind, name) => ({
  id,
  kind,
  title: name,
  year: 2024,
  overview:
    "Sıradan bir gecede başlayan, sınırları aşan bir hikâye. Büyük ekran için güzel bir keşif.",
  posterUrl: null,
  backdropUrl: null,
  genres: ["Dram", "Gerilim"],
  cast: ["Bir Oyuncu", "İkinci Oyuncu"],
  moods: ["Sürükleyici"],
  rating: 8.5,
  certification: "16+",
  runtime: 110,
  seasons: 2,
  episodeCount: 3,
  quality: "HD",
  isNew: true,
  inList: false,
  progress: null,
  resumeEpisodeId: null,
  firstEpisodeId: id * 10,
});
const items = [
  title(1, "MOVIE", "Gece Yolculuğu"),
  title(2, "SERIES", "Son İstasyon"),
  title(3, "ANIME", "Gökyüzüne Doğru"),
  title(4, "MOVIE", "Parazit"),
];
test("scrolling down and repeatedly up restores the entire hero before the menu", async ({
  page,
}) => {
  await setup(page);
  await expect(page.locator(".hero-play")).toBeFocused();
  for (let cycle = 0; cycle < 2; cycle++) {
    for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowDown");
    expect(
      await page.locator(".main-scroll").evaluate((el) => el.scrollTop),
    ).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");
    await expect(
      page.locator(".content-row .media-card").first(),
    ).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator(".hero-play")).toBeFocused();
    expect(
      await page.locator(".main-scroll").evaluate((el) => el.scrollTop),
    ).toBe(0);
    await page.keyboard.press("ArrowUp");
    await expect(
      page.getByRole("button", { name: "Ana Sayfa", exact: true }),
    ).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");
    await expect(
      page.getByRole("button", { name: "Ana Sayfa", exact: true }),
    ).toBeFocused();
    expect(await page.locator(".stage").evaluate((el) => el.scrollTop)).toBe(0);
    expect(await page.locator(".browse").evaluate((el) => el.scrollTop)).toBe(
      0,
    );
    expect(
      await page.locator(".main-scroll").evaluate((el) => el.scrollTop),
    ).toBe(0);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".hero-play")).toBeFocused();
  }
});
test("typography loads Inter weights and keeps Bebas Neue only for branding", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    document.fonts.load('500 21px "Inter"', "ÇĞİÖŞÜ çğıöşü"),
  );
  const styles = await page.evaluate(() => {
    const read = (s) => {
      const c = getComputedStyle(document.querySelector(s));
      return {
        family: c.fontFamily,
        size: c.fontSize,
        weight: c.fontWeight,
        tracking: c.letterSpacing,
      };
    };
    return {
      body: read("body"),
      logo: read(".brand"),
      hero: read(".hero h1"),
      nav: read("nav button"),
      caption: read(".card-caption"),
      turkish: document.fonts.check('500 21px "Inter"', "ÇĞİÖŞÜ çğıöşü"),
    };
  });
  expect(styles.body.family).toContain("Inter");
  expect(styles.body.size).toBe("16px");
  expect(styles.logo.family).toContain("Bebas Neue");
  expect(styles.hero.size).toBe("55px");
  expect(styles.hero.weight).toBe("700");
  expect(styles.nav.weight).toBe("500");
  expect(styles.caption.size).toBe("13px");
  expect(styles.caption.tracking).toBe("0.25px");
  expect(styles.turkish).toBe(true);
});
test("remote focus stays local instead of measuring the full catalog", async ({
  page,
}) => {
  await setup(page);
  await expect(page.locator(".hero-play")).toBeFocused();
  await page.evaluate(() => {
    document.body.classList.add("tv-device");
    const rail = document.querySelector(".content-row .rail");
    const original = rail.children[0];
    for (let i = 0; i < 120; i++) rail.appendChild(original.cloneNode(true));
    rail.querySelector(".media-card").focus();
    window.__rectCount = 0;
    const originalRect = Element.prototype.getBoundingClientRect;
    window.__restoreRects = () => {
      Element.prototype.getBoundingClientRect = originalRect;
    };
    Element.prototype.getBoundingClientRect = function () {
      window.__rectCount++;
      return originalRect.call(this);
    };
  });
  await page.keyboard.press("ArrowRight");
  expect(
    await page.evaluate(
      () =>
        document.activeElement ===
        document.querySelectorAll(".content-row .rail .media-card")[1],
    ),
  ).toBe(true);
  await page.keyboard.press("ArrowDown");
  expect(
    await page.evaluate(
      () =>
        document.activeElement.closest(".content-row") ===
        document.querySelectorAll(".content-row")[1],
    ),
  ).toBe(true);
  const reads = await page.evaluate(() => {
    const n = window.__rectCount;
    window.__restoreRects();
    return n;
  });
  expect(reads).toBeLessThanOrEqual(10);
});
test("slow native seeks are serialized and never save an unconfirmed target", async ({
  page,
}) => {
  await setup(page, { slowSeek: true });
  await page.clock.install();
  await page
    .getByRole("button", { name: "Daha fazla bilgi", exact: true })
    .click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Duraklat", exact: true }),
  ).toBeDisabled();
  await page.clock.runFor(4100);
  await expect(
    page.getByRole("button", { name: "Duraklat", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "10 saniye ileri" }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 417 })),
  );
  await page.clock.runFor(8100);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const calls = await page.evaluate(() =>
    window.__avCalls.filter((c) => c[0] === "seek").map((c) => c[1]),
  );
  expect(calls).toHaveLength(3);
  expect(calls[2]).toBeGreaterThan(calls[1]);
});
test("failed native seek keeps the confirmed progress and supports retry", async ({
  page,
}) => {
  await setup(page, { seekFailure: true });
  await page
    .getByRole("button", { name: "Daha fazla bilgi", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Baştan başlat", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Duraklat", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "10 saniye ileri" }).click();
  await expect(page.getByRole("status")).toContainText("Sarma yapılamadı");
  await page.getByRole("button", { name: "Oynatıcıyı kapat" }).click();
  const cached = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("keremflix.progress.http://192.168.1.240:3210:10"),
    ),
  );
  expect(cached.seconds).toBeLessThan(130);
});
function eps(id) {
  return [0, 1, 2].map((n) => ({
    id: id * 10 + n,
    season: n < 2 ? 1 : 2,
    number: n < 2 ? n + 1 : 1,
    name: ["Başlangıç", "Yol Ayrımı", "Yeni Gün"][n],
    quality: "HD",
    seconds: n === 0 ? 120 : 0,
    duration: 600,
  }));
}
async function setup(
  page,
  {
    offline = false,
    noNext = false,
    failPlayback = false,
    slowSeek = false,
    seekFailure = false,
  } = {},
) {
  const library = items.map((t) => ({ ...t }));
  await page.addInitScript(
    ({ failPlayback, slowSeek, seekFailure }) => {
      window.KF_TEST = true;
      window.__avCalls = [];
      let time = 120000,
        phase = "NONE",
        seeking = false,
        paused = false,
        listener = {},
        timer;
      function record(name, ...args) {
        window.__avCalls.push([name, ...args]);
      }
      window.webapis = {
        avplay: {
          open: (u) => {
            phase = "IDLE";
            record("open", u);
          },
          setDisplayRect: (...a) => record("display", ...a),
          setDisplayMethod: (m) => record("mode", m),
          setSilentSubtitle: (v) => {
            if (phase === "READY")
              throw Error("InvalidStateError: async READY");
            record("silent", v);
          },
          setListener: (l) => {
            listener = l;
            window.__avListener = l;
          },
          prepareAsync: (ok, err) => {
            setTimeout(() => {
              phase = "READY";
              return failPlayback ? err("TEST_CODEC_ERROR") : ok();
            }, 25);
          },
          getDuration: () => 600000,
          getCurrentTime: () => {
            if (seeking) throw Error("AVPlay busy");
            return time;
          },
          play: () => {
            phase = "PLAYING";
            record("play");
            paused = false;
            clearInterval(timer);
            timer = setInterval(() => {
              if (!paused) {
                time += 1000;
                listener.oncurrentplaytime?.(time);
              }
            }, 1000);
          },
          pause: () => {
            if (seeking) throw Error("AVPlay busy");
            paused = true;
            record("pause");
          },
          stop: () => {
            clearInterval(timer);
            record("stop");
          },
          close: () => record("close"),
          seekTo: (v, ok, error) => {
            if (seeking) throw Error("Concurrent native seek");
            seeking = true;
            record("seek", v);
            const finish = () => {
              seeking = false;
              if (seekFailure) {
                error?.("TEST_SEEK_FAILED");
                return;
              }
              time = v;
              listener.oncurrentplaytime?.(time);
              ok?.();
            };
            if (slowSeek) setTimeout(finish, 4000);
            else finish();
          },
          getTotalTrackInfo: () => [
            { type: "AUDIO", index: 0, extra_info: '{"language":"tur"}' },
            { type: "AUDIO", index: 1, extra_info: '{"language":"eng"}' },
            { type: "TEXT", index: 2, extra_info: '{"track_lang":"eng"}' },
          ],
          getCurrentStreamInfo: () => [
            { type: "AUDIO", index: 0, extra_info: "{}" },
          ],
          setSelectTrack: (...a) => record("track", ...a),
          setSpeed: (v) => record("speed", v),
        },
        appcommon: { setScreenSaver: (v) => record("screensaver", v) },
      };
    },
    { failPlayback, slowSeek, seekFailure },
  );
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url()),
      p = u.pathname;
    const send = (v) =>
      route.fulfill({
        json: v,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    if (p.includes("/artwork/"))
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="g"><stop stop-color="#273742"/><stop offset="1" stop-color="#865d42"/></linearGradient></defs><path fill="url(#g)" d="M0 0h1920v1080H0z"/></svg>',
      });
    if (offline)
      return route.fulfill({ status: 503, json: { error: "offline" } });
    if (p.endsWith("/home")) {
      const k = u.searchParams.get("kind"),
        set = library.filter((i) => !k || i.kind === k);
      return send({
        hero: set[0] || null,
        continueWatching: [{ ...set[0], progress: 0.2, resumeEpisodeId: 10 }],
        recent: set,
        topRated: set,
        genres: [{ genre: "Dram", items: set }],
      });
    }
    if (p.endsWith("/catalog")) return send({ items: library });
    if (p.includes("/mobile/title/")) {
      const t = library.find((t) => t.id === Number(p.split("/").pop()));
      return send({
        title: { ...t, resumeEpisodeId: t.id * 10 },
        episodes: noNext ? eps(t.id).slice(0, 1) : eps(t.id),
        similar: library.filter((i) => i.id !== t.id),
      });
    }
    if (p.includes("/subtitle/"))
      return route.fulfill({
        contentType: "text/vtt",
        body: "WEBVTT\n\n00:01:00.000 --> 00:05:00.000\nHer hikâye, yeni bir dünya.",
      });
    if (p === "/api/list") {
      const t = library.find(
        (t) => t.id === route.request().postDataJSON().titleId,
      );
      t.inList = !t.inList;
      return send({ inList: t.inList });
    }
    if (p === "/api/progress") return send({ ok: true });
    return send({ items });
  });
  await page.route("**/health", (route) =>
    route.fulfill({ json: { service: "keremflix-tv", upstream: true } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Gece Yolculuğu", exact: true }),
  )
    .toBeVisible()
    .catch(async (e) => {
      if (!offline) throw e;
    });
}
async function openPlayer(page, series = false) {
  if (series) {
    await page.getByRole("button", { name: "Diziler", exact: true }).click();
    await page
      .getByRole("heading", { name: "Son İstasyon", exact: true })
      .waitFor();
  }
  await page
    .getByRole("button", { name: "Daha fazla bilgi", exact: true })
    .click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Duraklat", exact: true }),
  ).toBeEnabled();
}
test("home, all categories, full library, sorting and remote focus", async ({
  page,
}) => {
  await setup(page);
  for (const name of ["Diziler", "Filmler", "Anime"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".hero")).toBeVisible();
    await page
      .getByRole("button", { name: "Bütün yapımlar", exact: true })
      .click();
    await expect(
      page.locator(".catalog-grid .media-card").first(),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Yeni Eklenenler", exact: true })
    .click();
  await expect(page.locator(".catalog-grid .media-card")).toHaveCount(4);
  await page.getByRole("button", { name: "A–Z", exact: true }).click();
  await expect(
    page.locator(".catalog-grid .media-card").first(),
  ).toHaveAttribute("aria-label", "Gece Yolculuğu");
  await page.locator(".catalog-grid .media-card").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".catalog-grid .media-card").nth(1)).toBeFocused();
});
test("details, seasons, list, personal likes and Back restores card focus", async ({
  page,
}) => {
  await setup(page);
  const card = page.locator('[data-focus-key="recent-2"]');
  await card.click();
  await expect(
    page.getByRole("dialog", { name: "Son İstasyon", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "2. Sezon", exact: true }).click();
  await expect(page.locator(".episode")).toHaveCount(1);
  await page.getByRole("button", { name: "2. Sezon", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".episode").first()).toBeFocused();
  await page.getByRole("button", { name: "Listeme ekle", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Listemden çıkar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Beğendim", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Beğeniyi kaldır", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
  await page.getByRole("button", { name: "Listem", exact: true }).click();
  await expect(page.locator(".catalog-grid .media-card")).toHaveCount(1);
  await page.locator(".catalog-grid .media-card").click();
  await page
    .getByRole("button", { name: "Listemden çıkar", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Burada yerin hazır")).toBeVisible();
});
test("search keyboard, input, no results and clear", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  await page.getByRole("textbox", { name: "Yapım ara" }).fill("parazit");
  await expect(page.locator(".search-grid .media-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Yapım ara" }).fill("xxxxxxxx");
  await expect(page.getByText("Burada bir şey bulamadık")).toBeVisible();
  await page.getByRole("button", { name: "Aramayı temizle" }).click();
  await page.getByRole("button", { name: "G", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Yapım ara" })).toHaveValue(
    "g",
  );
  await page.getByRole("button", { name: "Son harfi sil" }).click();
  await expect(page.locator(".search-grid .media-card")).toHaveCount(4);
});
test("settings persist, validate server and show connection success", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Profil ve ayarlar" }).click();
  await expect(
    page.getByRole("heading", { name: "Ayarlar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Büyük", exact: true }).click();
  await page
    .getByRole("button", { name: "Sonraki bölümü otomatik oynat" })
    .click();
  await expect(
    page.getByRole("button", { name: "Sonraki bölümü otomatik oynat" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Sunucu adresi").fill("javascript:test");
  await page.getByRole("button", { name: "Test et ve kaydet" }).click();
  await expect(page.getByRole("status")).toContainText("Sunucu adresi");
  await page.getByLabel("Sunucu adresi").fill("http://192.168.1.240:3210");
  await page.getByRole("button", { name: "Test et ve kaydet" }).click();
  await expect(page.getByRole("status")).toContainText("kaydedildi");
  await page.reload();
  await page.getByRole("button", { name: "Profil ve ayarlar" }).click();
  await expect(
    page.getByRole("button", { name: "Sonraki bölümü otomatik oynat" }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("player bounds, pause, seek, tracks, subtitles, speed, settings and return", async ({
  page,
}) => {
  await setup(page);
  await openPlayer(page);
  const bounds = await page.locator(".player-bottom").boundingBox();
  expect(bounds.y).toBeGreaterThan(600);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(1081);
  await page.getByRole("button", { name: "Duraklat", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Oynat", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "10 saniye ileri" }).click();
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowLeft");
  await page
    .getByRole("button", { name: "Ses ve altyazı", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Ses ve altyazı" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "İngilizce", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Kapalı", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Oynatma hızı", exact: true }).click();
  await page.getByRole("button", { name: "2×", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Oynatıcı ayarları", exact: true })
    .click();
  await page.getByRole("button", { name: "Büyük", exact: true }).click();
  await page.getByRole("button", { name: "+0.5 sn", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Ekranı doldur", exact: true })
    .click();
  const calls = await page.evaluate(() => window.__avCalls);
  expect(
    calls.some((c) => c[0] === "track" && c[1] === "AUDIO" && c[2] === 1),
  ).toBeTruthy();
  expect(calls.some((c) => c[0] === "speed" && c[1] === 2)).toBeTruthy();
  expect(calls.some((c) => c[0] === "seek")).toBeTruthy();
  await page.getByRole("button", { name: "Oynatıcıyı kapat" }).click();
  await expect(
    page.getByRole("dialog", { name: "Gece Yolculuğu", exact: true }),
  ).toBeVisible();
});
for (const series of [false, true])
  test(`player remote crosses both control groups in ${series ? "series" : "movies"}`, async ({
    page,
  }) => {
    await setup(page, { noNext: !series });
    await openPlayer(page, series);
    const buttons = page.locator(".player-controls button:not(:disabled)");
    const count = await buttons.count();
    await buttons.first().focus();
    for (let i = 1; i < count; i++) {
      await page.keyboard.press("ArrowRight");
      await expect(buttons.nth(i)).toBeFocused();
    }
    await page.keyboard.press("ArrowRight");
    await expect(buttons.last()).toBeFocused();
    for (let i = count - 2; i >= 0; i--) {
      await page.keyboard.press("ArrowLeft");
      await expect(buttons.nth(i)).toBeFocused();
    }
    await page.keyboard.press("ArrowLeft");
    await expect(buttons.first()).toBeFocused();
    await page
      .getByRole("button", { name: "Oynatma hızı", exact: true })
      .focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("slider")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("button", { name: "Oynatma hızı", exact: true }),
    ).toBeFocused();
  });

test("player automatically hides controls and remote keys bring them back", async ({
  page,
}) => {
  await setup(page);
  await openPlayer(page);
  await expect(page.locator(".player-layer")).toHaveClass(/controls-hidden/, {
    timeout: 8000,
  });
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: "Duraklat", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Gece Yolculuğu", exact: true }),
  ).toBeVisible();
});
test("episodes, completion countdown and next episode", async ({ page }) => {
  await setup(page);
  await openPlayer(page, true);
  await page.getByRole("button", { name: "Bölümler", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bölümler", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /2\. SEZONYeni Gün|2\. SEZON1\. Yeni Gün/ })
    .count();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__avListener.onstreamcompleted());
  await expect(page.getByText("SIRADAKİ BÖLÜM")).toBeVisible();
  await page.getByRole("button", { name: "Şimdi oynat", exact: true }).click();
  await expect(page.locator(".player-top")).toContainText("2. bölüm");
});
test("player error permits retry and return without blank screen", async ({
  page,
}) => {
  await setup(page, { failPlayback: true });
  await page
    .getByRole("button", { name: "Daha fazla bilgi", exact: true })
    .click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("TEST_CODEC_ERROR");
  await page.getByRole("button", { name: "Geri dön", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Gece Yolculuğu", exact: true }),
  ).toBeVisible();
});
test("offline screen can still open connection settings", async ({ page }) => {
  await setup(page, { offline: true });
  await expect(
    page.getByRole("heading", { name: "Bağlantıya kısa bir ara" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bağlantı ayarları", exact: true })
    .click();
  await expect(page.getByLabel("Sunucu adresi")).toBeVisible();
});
test("1280 screen scales the full player inside visible edges", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await setup(page);
  await openPlayer(page);
  const rect = await page.locator(".player-bottom").boundingBox();
  expect(rect.y).toBeGreaterThan(350);
  expect(rect.y + rect.height).toBeLessThanOrEqual(721);
  const button = await page
    .getByRole("button", { name: "Oynatıcıyı kapat" })
    .boundingBox();
  expect(button.x).toBeGreaterThan(0);
});
test("automatic next episode countdown advances without user input", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  await openPlayer(page, true);
  await page.evaluate(() => window.__avListener.onstreamcompleted());
  await expect(page.getByText("SIRADAKİ BÖLÜM")).toBeVisible();
  await page.clock.runFor(11000);
  await expect(page.locator(".player-top")).toContainText("2. bölüm");
});
test("last episode ends cleanly and saves completion at full duration", async ({
  page,
}) => {
  await setup(page, { noNext: true });
  let progress;
  await page.route("**/api/progress", (r) => {
    progress = r.request().postDataJSON();
    return r.fulfill({ json: { ok: true } });
  });
  await openPlayer(page);
  await page.evaluate(() => window.__avListener.onstreamcompleted());
  await expect(page.getByText("İzleme tamamlandı")).toBeVisible();
  await expect.poll(() => progress?.seconds).toBe(600);
  await expect(
    page.getByRole("button", { name: "Şimdi oynat", exact: true }),
  ).toHaveCount(0);
});
test("external subtitle overlay, offset and native subtitle selection", async ({
  page,
}) => {
  await setup(page);
  await openPlayer(page);
  await expect(page.locator(".subtitle")).toContainText("Her hikâye");
  await page
    .getByRole("button", { name: "Ses ve altyazı", exact: true })
    .click();
  await page
    .getByRole("button", { name: "İngilizce", exact: true })
    .last()
    .click();
  await page.evaluate(() =>
    window.__avListener.onsubtitlechange(2000, "<b>Dahili altyazı</b>"),
  );
  await expect(page.locator(".subtitle")).toHaveText("Dahili altyazı");
  await page.getByRole("button", { name: "Kapalı", exact: true }).click();
  await expect(page.locator(".subtitle")).toHaveCount(0);
});
test("subtitle appearance persists, uses full player height and resets independently", async ({
  page,
}) => {
  await setup(page);
  await openPlayer(page);
  const subtitles = page.getByRole("button", {
    name: "Ses ve altyazı",
    exact: true,
  });
  const speed = page.getByRole("button", { name: "Oynatma hızı", exact: true });
  expect((await subtitles.boundingBox()).x).toBeLessThan(
    (await speed.boundingBox()).x,
  );
  await subtitles.click();
  await page.getByRole("button", { name: "Yazıyı büyüt", exact: true }).click();
  await page.getByRole("button", { name: "Siyah arka plan" }).click();
  await page.getByRole("button", { name: "Üst boşluk", exact: true }).click();
  await expect(page.locator(".subtitle")).toHaveCSS("font-size", "42px");
  await expect(page.locator(".subtitle")).not.toHaveClass(
    /subtitle-background/,
  );
  const top = await page.locator(".subtitle").boundingBox();
  expect(top.y).toBeGreaterThanOrEqual(0);
  expect(top.y + top.height).toBeLessThan(150);
  await page.getByRole("button", { name: "Alt boşluk", exact: true }).click();
  const bottom = await page.locator(".subtitle").boundingBox();
  expect(bottom.y).toBeGreaterThan(950);
  expect(bottom.y + bottom.height).toBeLessThan(1080);
  await page.getByRole("button", { name: "Menüyü kapat", exact: true }).click();
  await expect(page.locator(".subtitle")).toHaveCSS("top", "1004.4px");
  await page.getByRole("button", { name: "Oynatıcıyı kapat" }).click();
  await page.reload();
  await openPlayer(page);
  await expect(page.locator(".subtitle")).toHaveCSS("font-size", "42px");
  await expect(page.locator(".subtitle")).toHaveCSS("top", "1004.4px");
  await subtitles.click();
  await page
    .getByRole("button", { name: "Altyazıları varsayılana döndür" })
    .click();
  await expect(page.locator(".subtitle")).toHaveCSS("font-size", "38px");
  await expect(page.locator(".subtitle")).toHaveClass(/subtitle-background/);
  await expect(page.locator(".subtitle")).toHaveCSS("top", "972px");
});

test("embedded subtitle cues expire on the media clock and stale cues stay hidden after disabling", async ({
  page,
}) => {
  await setup(page);
  await openPlayer(page);
  await page.getByRole("button", { name: "Duraklat", exact: true }).click();
  await page
    .getByRole("button", { name: "Ses ve altyazı", exact: true })
    .click();
  await page
    .getByRole("button", { name: "İngilizce", exact: true })
    .last()
    .click();
  await page.evaluate(() =>
    window.__avListener.onsubtitlechange(
      "2000",
      "İlk satır<br>İkinci &amp; son",
    ),
  );
  await expect(page.locator(".subtitle")).toHaveText("İlk satır\nİkinci & son");
  await page.waitForTimeout(2100);
  await expect(page.locator(".subtitle")).toBeVisible();
  await page.evaluate(() =>
    window.__avListener.oncurrentplaytime(
      window.webapis.avplay.getCurrentTime() + 3000,
    ),
  );
  await expect(page.locator(".subtitle")).toHaveCount(0);
  await page.getByRole("button", { name: "Kapalı", exact: true }).click();
  await page.evaluate(() =>
    window.__avListener.onsubtitlechange(2000, "Eski parça"),
  );
  await expect(page.locator(".subtitle")).toHaveCount(0);
});

test("converted embedded subtitles render and late requests cannot re-enable disabled captions", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/tv/subtitles/*", (route) =>
    route.fulfill({
      json: {
        tracks: [
          {
            type: "TEXT",
            index: 5,
            source: "server",
            extra_info: '{"track_lang":"tur"}',
          },
        ],
      },
    }),
  );
  await page.route("**/api/tv/subtitles/*/5", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      contentType: "text/vtt",
      body: "WEBVTT\n\n00:01:00.000 --> 00:05:00.000\nGömülü Türkçe altyazı",
    });
  });
  await openPlayer(page);
  await page
    .getByRole("button", { name: "Ses ve altyazı", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Türkçe", exact: true })
    .last()
    .click();
  await expect(page.locator(".subtitle")).toHaveText("Gömülü Türkçe altyazı");
  await page
    .getByRole("button", { name: "Türkçe", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Kapalı", exact: true }).click();
  await page.waitForTimeout(1100);
  await expect(page.locator(".subtitle")).toHaveCount(0);
});

test("hardware media keys pause and resume and backgrounding pauses playback", async ({
  page,
}) => {
  await setup(page);
  await openPlayer(page);
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 19 })),
  );
  await expect(
    page.getByRole("button", { name: "Oynat", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 415 })),
  );
  await expect(
    page.getByRole("button", { name: "Duraklat", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "Oynat", exact: true }),
  ).toBeVisible();
});
test("volume and mute use the TV audio API when available", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    let volume = 50,
      mute = false;
    window.tizen = {
      tvaudiocontrol: {
        getVolume: () => volume,
        setVolume: (v) => {
          volume = v;
          window.__volume = v;
        },
        isMute: () => mute,
        setMute: (v) => {
          mute = v;
          window.__mute = v;
        },
      },
    };
  });
  await openPlayer(page);
  await page.getByRole("button", { name: "Sesi kapat", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__mute)).toBe(true);
  await page
    .getByRole("button", { name: "Oynatıcı ayarları", exact: true })
    .click();
  await page.getByRole("button", { name: "+5", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__volume))
    .toBeGreaterThan(0);
});
test("HTML5 fallback reports an unsupported stream without crashing", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    delete window.webapis;
  });
  await page
    .getByRole("button", { name: "Daha fazla bilgi", exact: true })
    .click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("codec");
});

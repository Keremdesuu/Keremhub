import { SubtitleSettings } from "./SubtitleSettings.tsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, image, preferences, persist } from "./api.ts";
import type { Title, Home, Detail, Episode, Preferences } from "./types.ts";
import { resume, time, serverURL, moveFocus } from "./lib.ts";
import { Icon } from "./icons.tsx";
import { Player } from "./Player.tsx";
import { mergeProgress } from "./progress.ts";
import { warmArtwork } from "./images.ts";
const sections = [
  ["home", "Ana Sayfa"],
  ["SERIES", "Diziler"],
  ["MOVIE", "Filmler"],
  ["ANIME", "Anime"],
  ["new", "Yeni Eklenenler"],
  ["list", "Listem"],
];
function Picture({
  title,
  role = "card",
  className = "",
}: {
  title: Title;
  role?: string;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={image(title, role)}
      alt=""
      loading={role === "hero" ? "eager" : "lazy"}
      decoding="async"
      onLoad={(event) => {
        if (role !== "hero") warmArtwork(event.currentTarget);
      }}
      onError={(e) => {
        e.currentTarget.style.opacity = "0";
      }}
    />
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}
function Metadata({ t }: { t: Title }) {
  return (
    <div className="metadata">
      {t.isNew && <span className="fresh">Yeni</span>}
      {t.rating && <span className="fresh">★ {t.rating.toFixed(1)}</span>}
      <span>{t.year}</span>
      <span>
        {t.kind === "MOVIE"
          ? t.runtime
            ? t.runtime + " dk"
            : "Film"
          : t.seasons + " sezon"}
      </span>
      {t.certification && <Badge>{t.certification}</Badge>}
      {t.quality && <Badge>{t.quality}</Badge>}
    </div>
  );
}
function Card({
  t,
  onOpen,
  rank,
  focusKey,
}: {
  t: Title;
  onOpen: (id: number) => void;
  rank?: number;
  focusKey: string;
}) {
  return (
    <div className={"card-wrap " + (rank ? "rank-card" : "")}>
      {rank && <span className="rank-number">{rank}</span>}
      <button
        className="media-card"
        aria-label={t.title}
        data-focus-key={focusKey}
        onClick={() => onOpen(t.id)}
      >
        <Picture title={t} role={rank ? "poster" : "card"} />
        <div className="card-shade" />
        <span className="mini-brand">K</span>
        {t.isNew && <span className="new-tag">Yeni eklendi</span>}
        <strong>{t.title}</strong>
        {t.progress !== null && t.progress > 0 && (
          <span className="card-progress">
            <span style={{ width: t.progress * 100 + "%" }} />
          </span>
        )}
      </button>
      <div className="card-caption">
        <span>
          {t.year} <span className="dot">•</span>{" "}
          {t.kind === "MOVIE" ? "Film" : t.seasons + " sezon"}
        </span>
        {t.quality && <span className="tiny-badge">{t.quality}</span>}
      </div>
    </div>
  );
}
function Row({
  label,
  items,
  onOpen,
  rank = false,
  id,
}: {
  label: string;
  items: Title[];
  onOpen: (id: number) => void;
  rank?: boolean;
  id: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  return (
    <section className={"content-row " + (rank ? "ranking" : "")}>
      <div className="row-heading">
        <h2>{label}</h2>
        <div className="row-arrows">
          <button
            aria-label={label + " önceki"}
            onClick={() =>
              ref.current?.scrollBy({
                left: -1250,
                behavior: window.tizen ? "auto" : "smooth",
              })
            }
          >
            <Icon name="back" size={23} />
          </button>
          <button
            aria-label={label + " sonraki"}
            onClick={() =>
              ref.current?.scrollBy({
                left: 1250,
                behavior: window.tizen ? "auto" : "smooth",
              })
            }
          >
            <Icon name="chevron" size={23} />
          </button>
        </div>
      </div>
      <div className="rail" ref={ref}>
        {items.map((t, i) => (
          <Card
            key={t.id}
            t={t}
            rank={rank ? i + 1 : undefined}
            onOpen={onOpen}
            focusKey={id + "-" + t.id}
          />
        ))}
      </div>
    </section>
  );
}
function Hero({
  t,
  onOpen,
  onPlay,
}: {
  t: Title;
  onOpen: (id: number) => void;
  onPlay: (id: number) => void;
}) {
  return (
    <section className="hero" aria-label="Öne çıkan yapım">
      <Picture title={t} role="hero" className="hero-image" />
      <div className="hero-gradient" />
      <div className="hero-copy">
        <div className="original">
          <span>K</span> KEREMFLIX'TE KEŞFET
        </div>
        <h1 className={t.title.length > 22 ? "long-title" : ""}>{t.title}</h1>
        <Metadata t={t} />
        <p>
          {t.overview ||
            "Büyük hikâyeler. Senin ekranında. Kendi kitaplığından bir keşfe çık."}
        </p>
        <div className="button-row">
          <button className="white-btn hero-play" onClick={() => onPlay(t.id)}>
            <Icon name="play" size={32} />
            İzle
          </button>
          <button className="glass-btn" onClick={() => onOpen(t.id)}>
            <Icon name="info" size={30} />
            Daha fazla bilgi
          </button>
        </div>
      </div>
      <div className="hero-side">
        <span>BUGÜNÜN SEÇİMİ</span>
        <b>{t.genres.slice(0, 2).join(" · ")}</b>
      </div>
    </section>
  );
}
function DetailView({
  data,
  onClose,
  onPlay,
  onOpen,
  onList,
  notify,
}: {
  data: Detail;
  onClose: () => void;
  onPlay: (ep: Episode, start?: boolean) => void;
  onOpen: (id: number) => void;
  onList: (t: Title) => Promise<void>;
  notify: (s: string) => void;
}) {
  const t = data.title,
    seasons = Array.from(new Set(data.episodes.map((e) => e.season))),
    last =
      data.episodes.find((e) => e.id === t.resumeEpisodeId) || data.episodes[0];
  const [season, setSeason] = useState(last?.season || 1),
    [liking, setLiking] = useState(
      localStorage.getItem("keremflix.like." + t.id) || "",
    ),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    document
      .querySelector<HTMLButtonElement>(".detail-dialog .white-btn")
      ?.focus();
  }, [t.id]);
  return (
    <div className="modal-backdrop">
      <section
        className="detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
      >
        <div className="detail-scroll">
          <div className="detail-hero">
            <Picture title={t} role="hero" />
            <div className="detail-gradient" />
            <div className="detail-hero-copy">
              <span className="original">
                <span>K</span>{" "}
                {t.kind === "MOVIE"
                  ? "FİLM"
                  : t.kind === "SERIES"
                    ? "DİZİ"
                    : "ANİME"}
              </span>
              <h1>{t.title}</h1>
              <div className="button-row">
                {last && (
                  <button className="white-btn" onClick={() => onPlay(last)}>
                    <Icon name="play" />
                    {resume(last) > 0 ? "Devam et" : "İzle"}
                  </button>
                )}
                <button
                  className={"round " + (t.inList ? "selected" : "")}
                  aria-label={t.inList ? "Listemden çıkar" : "Listeme ekle"}
                  disabled={saving}
                  onClick={() => {
                    setSaving(true);
                    onList(t).finally(() => setSaving(false));
                  }}
                >
                  <Icon name={t.inList ? "check" : "plus"} />
                </button>
                <button
                  className={"round " + (liking ? "selected" : "")}
                  aria-label={liking ? "Beğeniyi kaldır" : "Beğendim"}
                  onClick={() => {
                    const value = liking ? "" : "yes";
                    localStorage.setItem("keremflix.like." + t.id, value);
                    setLiking(value);
                    notify(value ? "Beğenilere eklendi" : "Beğeni kaldırıldı");
                  }}
                >
                  <Icon name="thumb" />
                </button>
                {last && resume(last) > 0 && (
                  <button
                    className="glass-btn"
                    onClick={() => onPlay(last, true)}
                  >
                    Baştan başlat
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="detail-body">
            <div className="detail-columns">
              <div>
                <Metadata t={t} />
                {last && last.seconds > 20 && (
                  <div className="resume-line">
                    <span>{time(last.seconds)} izlendi</span>
                    <span className="resume-track">
                      <span
                        style={{
                          width:
                            (last.duration
                              ? Math.min(
                                  100,
                                  (last.seconds / last.duration) * 100,
                                )
                              : 0) + "%",
                        }}
                      />
                    </span>
                  </div>
                )}
                <p className="synopsis">
                  {t.overview || "Bu yapım için henüz açıklama eklenmemiş."}
                </p>
              </div>
              <aside>
                <p>
                  <span>Oyuncular: </span>
                  {t.cast?.slice(0, 8).join(", ") || "Bilgi bulunmuyor"}
                </p>
                <p>
                  <span>Türler: </span>
                  {t.genres.join(", ")}
                </p>
                {t.moods?.length > 0 && (
                  <p>
                    <span>Bu yapım: </span>
                    {t.moods.join(", ")}
                  </p>
                )}
              </aside>
            </div>
            {(t.kind !== "MOVIE" || data.episodes.length > 1) && (
              <>
                <div className="episodes-heading">
                  <h2>Bölümler</h2>
                  <div className="season-tabs">
                    {seasons.map((s) => (
                      <button
                        key={s}
                        className={"chip " + (season === s ? "active" : "")}
                        onClick={() => setSeason(s)}
                      >
                        {s}. Sezon
                      </button>
                    ))}
                  </div>
                </div>
                <div className="episode-list">
                  {data.episodes
                    .filter((e) => e.season === season)
                    .map((e) => (
                      <button
                        key={e.id}
                        className="episode"
                        aria-label={
                          e.season +
                          ". sezon " +
                          e.number +
                          ". bölüm " +
                          (e.name || "")
                        }
                        onClick={() => onPlay(e)}
                      >
                        <span className="episode-number">{e.number}</span>
                        <div className="episode-art">
                          <Picture title={t} />
                          <Icon name="play" size={36} />
                        </div>
                        <div className="episode-copy">
                          <strong>{e.name || e.number + ". Bölüm"}</strong>
                          <p>
                            {e.quality || "Orijinal dosya"}
                            {e.duration ? " · " + time(e.duration) : ""}
                          </p>
                          {e.duration > 0 && (
                            <span className="episode-progress">
                              <span
                                style={{
                                  width:
                                    Math.min(
                                      100,
                                      (e.seconds / e.duration) * 100,
                                    ) + "%",
                                }}
                              />
                            </span>
                          )}
                        </div>
                        <span className="episode-action">
                          {resume(e) > 0 ? "Devam et" : "İzle"}
                          <Icon name="chevron" />
                        </span>
                      </button>
                    ))}
                </div>
              </>
            )}
            <Row
              label="Bunları da sevebilirsin"
              items={data.similar}
              onOpen={onOpen}
              id="similar"
            />
            <div className="about-title">
              <h2>{t.title} hakkında</h2>
              <p>
                {t.year} · {t.episodeCount}{" "}
                {t.kind === "MOVIE" ? "dosya" : "bölüm"} ·{" "}
                {t.genres.join(" / ")}
              </p>
              <span>KEREMFLIX · KİŞİSEL KİTAPLIĞIN</span>
            </div>
          </div>
        </div>
        <button
          className="round detail-close"
          aria-label="Ayrıntıları kapat"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </section>
    </div>
  );
}
function Search({
  items,
  onOpen,
}: {
  items: Title[];
  onOpen: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const normalized = (v: string) => v.toLocaleLowerCase("tr-TR");
  const results = q.trim()
    ? items.filter((t) => normalized(t.title).includes(normalized(q.trim())))
    : items.slice(0, 12);
  return (
    <section className="search-page">
      <div className="page-heading">
        <span className="eyebrow">BİR SONRAKİ FAVORİNİ BUL</span>
        <h1>Ne izlemek istersin?</h1>
      </div>
      <div className="search-layout">
        <div className="search-tools">
          <div className="search-input">
            <Icon name="search" />
            <input
              aria-label="Yapım ara"
              placeholder="Film, dizi veya anime"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document
                    .querySelector<HTMLButtonElement>(
                      ".search-results .media-card",
                    )
                    ?.focus();
                }
              }}
            />
            {q && (
              <button aria-label="Aramayı temizle" onClick={() => setQ("")}>
                <Icon name="close" />
              </button>
            )}
          </div>
          <div className="keyboard">
            {"ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789".split("").map((c) => (
              <button
                key={c}
                onClick={() => setQ(q + c.toLocaleLowerCase("tr-TR"))}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="keyboard-actions">
            <button onClick={() => setQ(q + " ")}>Boşluk</button>
            <button
              aria-label="Son harfi sil"
              onClick={() => setQ(q.slice(0, -1))}
            >
              ⌫ Sil
            </button>
            <button onClick={() => setQ("")}>Temizle</button>
          </div>
          <p className="search-note">
            Kumandayla harfleri seç veya klavyeyi kullan.
          </p>
        </div>
        <div className="search-results">
          <h2>
            {q
              ? "“" + q + "” için " + results.length + " sonuç"
              : "Popüler aramalar"}
          </h2>
          {results.length ? (
            <div className="search-grid">
              {results.map((t) => (
                <Card
                  key={t.id}
                  t={t}
                  onOpen={onOpen}
                  focusKey={"search-" + t.id}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Icon name="search" size={60} />
              <h2>Burada bir şey bulamadık</h2>
              <p>Başka bir yapım adı deneyebilirsin.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function Settings({
  notify,
  onRefresh,
}: {
  notify: (s: string) => void;
  onRefresh: () => void;
}) {
  const [p, setP] = useState(preferences),
    [server, setServer] = useState(p.server),
    [status, setStatus] = useState(""),
    [checking, setChecking] = useState(false);
  function update(v: Partial<Preferences>) {
    const next = { ...preferences(), ...v };
    persist(next);
    setP(next);
  }
  async function check() {
    let candidate: string;
    try {
      candidate = serverURL(server);
    } catch (e) {
      notify((e as Error).message);
      return;
    }
    setChecking(true);
    setStatus("");
    try {
      const r = await fetch(candidate + "/health", {
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
      });
      const data = await r.json();
      if (!r.ok || data.service !== "keremflix-tv" || !data.upstream)
        throw Error("Keremflix servisi yanıt vermiyor.");
      update({ server: candidate });
      setStatus("Bağlantı başarılı");
      notify("Sunucu bağlantısı kaydedildi.");
      onRefresh();
    } catch (e) {
      setStatus("Bağlantı kurulamadı");
      notify((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  return (
    <section className="settings-page">
      <div className="page-heading">
        <span className="eyebrow">HER ŞEY SENİN KONTROLÜNDE</span>
        <h1>Ayarlar</h1>
      </div>
      <div className="settings-layout">
        <aside>
          <div className="avatar">K</div>
          <h2>Kerem</h2>
          <p>Kişisel sineman</p>
          <span className="version-tag">KEREMFLIX 2.0</span>
        </aside>
        <div className="settings-content">
          <section>
            <h2>Kitaplık bağlantısı</h2>
            <p>Monitörün ve Raspberry Pi aynı yerel ağda olmalı.</p>
            <label htmlFor="server-address">Sunucu adresi</label>
            <div className="server-form">
              <input
                id="server-address"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                spellCheck={false}
              />
              <button className="white-btn" disabled={checking} onClick={check}>
                {checking ? "Bağlanıyor…" : "Test et ve kaydet"}
              </button>
            </div>
            {status && (
              <p
                className={
                  status === "Bağlantı başarılı" ? "fresh" : "error-text"
                }
              >
                {status}
              </p>
            )}
          </section>
          <section>
            <h2>Oynatma tercihleri</h2>
            <button
              className="setting-toggle"
              aria-pressed={p.autoplay}
              onClick={() => update({ autoplay: !p.autoplay })}
            >
              <span>
                <strong>Sonraki bölümü otomatik oynat</strong>
                <small>Bölüm bitince 10 saniyelik geri sayım başlar.</small>
              </span>
              <span className={"toggle " + (p.autoplay ? "on" : "")} />
            </button>
          </section>
          <section>
            <h2>Altyazı görünümü</h2>
            <SubtitleSettings prefs={p} update={update} />
          </section>
          <section>
            <h2>Oynatıcı</h2>
            <p>
              {window.webapis?.avplay
                ? "Samsung AVPlay · Yerel video motoru"
                : "HTML5 · Tarayıcı önizlemesi"}
            </p>
            <p>
              Kalite, ses ve altyazı seçenekleri orijinal medya dosyasına
              bağlıdır.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
function Clock() {
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
  return <span className="header-clock">{clock}</span>;
}
function App() {
  const [page, setPage] = useState("home"),
    [home, setHome] = useState<Home | null>(null),
    [catalog, setCatalog] = useState<Title[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [detail, setDetail] = useState<Detail | null>(null),
    [playback, setPlayback] = useState<{ ep: Episode; start: boolean } | null>(
      null,
    ),
    [opening, setOpening] = useState(false),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState("Tümü"),
    [sort, setSort] = useState("Önerilen"),
    [scale, setScale] = useState(1);
  const requestId = useRef(0),
    lastFocus = useRef(""),
    detailHistory = useRef<Detail[]>([]),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    main = useRef<HTMLDivElement>(null),
    header = useRef<HTMLElement>(null),
    exitTime = useRef(0);
  const notify = useCallback((s: string) => {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  useEffect(() => {
    const resize = () =>
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setHome(null);
    setFilter("Tümü");
    main.current?.scrollTo(0, 0);
    Promise.all([
      api<Home>(
        "/api/mobile/home" +
          (["MOVIE", "SERIES", "ANIME"].includes(page) ? "?kind=" + page : ""),
        undefined,
        abort.signal,
      ),
      api<{ items: Title[] }>("/api/tv/catalog", undefined, abort.signal),
    ])
      .then(([h, c]) => {
        if (abort.signal.aborted) return;
        setHome(h);
        setCatalog(c.items);
        setLoading(false);
        setTimeout(() => {
          const scope = document.querySelector(".browse");
          scope
            ?.querySelector<HTMLButtonElement>("main button,main input")
            ?.focus();
        }, 100);
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          setLoading(false);
          setError(e.message);
        }
      });
    return () => abort.abort();
  }, [page, refresh]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("keremflix.pendingProgress");
      if (saved)
        api("/api/progress", JSON.parse(saved))
          .then(() => localStorage.removeItem("keremflix.pendingProgress"))
          .catch(() => {});
    } catch {}
    try {
      [
        "MediaPlay",
        "MediaPause",
        "MediaPlayPause",
        "MediaStop",
        "MediaRewind",
        "MediaFastForward",
      ].forEach((k) => {
        try {
          window.tizen?.tvinputdevice?.registerKey(k);
        } catch {}
      });
    } catch {}
  }, []);
  function navigate(next: string) {
    if (main.current) main.current.scrollTop = 0;
    document
      .querySelectorAll<HTMLElement>(".browse,.stage,#root")
      .forEach((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    requestId.current++;
    setOpening(false);
    setDetail(null);
    detailHistory.current = [];
    setPage(next);
  }
  async function openTitle(id: number, play = false) {
    const token = ++requestId.current;
    if (!detail)
      lastFocus.current =
        (document.activeElement as HTMLElement)?.dataset.focusKey || "";
    setOpening(true);
    try {
      const d = mergeProgress(await api<Detail>("/api/mobile/title/" + id));
      if (token !== requestId.current) return;
      if (detail) detailHistory.current.push(detail);
      setDetail(d);
      if (play) {
        const e =
          d.episodes.find((e) => e.id === d.title.resumeEpisodeId) ||
          d.episodes[0];
        if (e) setPlayback({ ep: e, start: false });
        else notify("Bu yapımın video dosyası yok.");
      }
    } catch (e) {
      if (token === requestId.current)
        notify("Yapım açılamadı: " + (e as Error).message);
    } finally {
      if (token === requestId.current) setOpening(false);
    }
  }
  function closeDetail() {
    if (detailHistory.current.length) {
      setDetail(detailHistory.current.pop()!);
      return;
    }
    setDetail(null);
    setTimeout(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>("[data-focus-key]"),
      ).find((el) => el.dataset.focusKey === lastFocus.current);
      target?.focus({ preventScroll: true });
    }, 30);
  }
  async function list(t: Title) {
    try {
      const result = await api<{ inList: boolean }>("/api/list", {
        titleId: t.id,
      });
      t.inList = result.inList;
      setDetail((d) =>
        d ? { ...d, title: { ...d.title, inList: result.inList } } : d,
      );
      setCatalog((c) =>
        c.map((i) => (i.id === t.id ? { ...i, inList: result.inList } : i)),
      );
      notify(result.inList ? "Listene eklendi" : "Listenden çıkarıldı");
    } catch (e) {
      notify("Liste güncellenemedi: " + (e as Error).message);
    }
  }
  function closePlayer() {
    setDetail((d) => (d ? mergeProgress(d) : d));
    setPlayback(null);
    setTimeout(
      () =>
        document
          .querySelector<HTMLButtonElement>(".detail-dialog .white-btn")
          ?.focus(),
      30,
    );
    setRefresh((r) => r + 1);
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (playback) return;
      const c = event.keyCode;
      if ([10009, 27, 461].includes(c)) {
        event.preventDefault();
        if (opening) {
          requestId.current++;
          setOpening(false);
        } else if (detail) closeDetail();
        else if (page !== "home") navigate("home");
        else if (Date.now() - exitTime.current < 2500) {
          window.tizen?.application?.getCurrentApplication()?.exit();
        } else {
          exitTime.current = Date.now();
          notify("Çıkmak için Geri tuşuna tekrar bas.");
        }
        return;
      }
      const dirs: Record<number, string> = {
        37: "left",
        38: "up",
        39: "right",
        40: "down",
      };
      const active = document.activeElement as HTMLElement;
      if (active?.tagName === "INPUT" && c !== 40) return;
      if (dirs[c]) {
        event.preventDefault();
        moveFocus(
          dirs[c],
          document.querySelector(detail ? ".detail-dialog" : ".browse"),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [page, detail, playback, opening]);
  const isCategory = ["MOVIE", "SERIES", "ANIME"].includes(page),
    isGrid =
      ["new", "list"].includes(page) || (isCategory && filter !== "Tümü");
  const added = (t: Title) =>
    typeof t.addedAt === "number"
      ? t.addedAt
      : new Date(t.addedAt || 0).getTime();
  const pageItems = catalog
    .filter(
      (t) =>
        (!isCategory || t.kind === page) &&
        (page !== "list" || t.inList) &&
        (filter === "Tümü" ||
          filter === "Bütün yapımlar" ||
          t.genres.includes(filter)),
    )
    .sort((a, b) =>
      sort === "A–Z"
        ? a.title.localeCompare(b.title, "tr")
        : sort === "Puan"
          ? (b.rating || 0) - (a.rating || 0)
          : sort === "Yıl"
            ? (b.year || 0) - (a.year || 0)
            : page === "new"
              ? added(b) - added(a)
              : 0,
    );
  const genres = Array.from(
    new Set(
      catalog
        .filter((t) => !isCategory || t.kind === page)
        .flatMap((t) => t.genres),
    ),
  ).slice(0, 8);
  return (
    <div
      className="stage"
      style={{
        transform: "scale(" + scale + ")",
        left: (window.innerWidth - 1920 * scale) / 2,
        top: (window.innerHeight - 1080 * scale) / 2,
      }}
    >
      <div
        className="browse"
        style={{ display: playback ? "none" : undefined }}
        aria-hidden={!!playback || !!detail}
      >
        <header
          ref={header}
          className={"header " + (page === "home" || isCategory ? "" : "solid")}
        >
          <button
            className="brand"
            aria-label="Keremflix ana sayfa"
            onClick={() => navigate("home")}
          >
            KEREMFLIX
          </button>
          <nav>
            {sections.map(([key, label]) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                onClick={() => navigate(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="header-right">
            <button
              className={"nav-icon " + (page === "search" ? "active" : "")}
              aria-label="Ara"
              onClick={() => navigate("search")}
            >
              <Icon name="search" size={30} />
            </button>
            <Clock />
            <button
              className="profile-button"
              aria-label="Profil ve ayarlar"
              onClick={() => navigate("settings")}
            >
              <span>K</span>
              <small>⌄</small>
            </button>
          </div>
        </header>
        <main
          ref={main}
          onScroll={(event) =>
            header.current?.classList.toggle(
              "scrolled",
              event.currentTarget.scrollTop > 40,
            )
          }
          className={
            "main-scroll " +
            ((page === "home" || isCategory) && !isGrid ? "with-hero" : "")
          }
        >
          {page === "settings" ? (
            <Settings
              notify={notify}
              onRefresh={() => setRefresh((r) => r + 1)}
            />
          ) : loading ? (
            <div className="loading-screen">
              <div className="loading-brand">K</div>
              <div className="spinner" />
              <p>Hikâyeler hazırlanıyor…</p>
            </div>
          ) : error ? (
            <div className="connection-error">
              <Icon name="info" size={64} />
              <h1>Bağlantıya kısa bir ara</h1>
              <p>
                Keremflix kitaplığına ulaşılamıyor. Pi’nin açık ve aynı ağda
                olduğundan emin ol.
              </p>
              <small>{error}</small>
              <div className="button-row">
                <button
                  className="white-btn"
                  onClick={() => setRefresh((r) => r + 1)}
                >
                  <Icon name="retry" />
                  Tekrar dene
                </button>
                <button
                  className="soft-btn"
                  onClick={() => navigate("settings")}
                >
                  Bağlantı ayarları
                </button>
              </div>
            </div>
          ) : page === "search" ? (
            <Search items={catalog} onOpen={(id) => void openTitle(id)} />
          ) : (
            <>
              {isCategory && (
                <div className="category-toolbar">
                  <h1>{sections.find((s) => s[0] === page)?.[1]}</h1>
                  <div className="genre-filters">
                    {["Tümü", "Bütün yapımlar", ...genres.slice(0, 5)].map(
                      (g) => (
                        <button
                          key={g}
                          className={"chip " + (filter === g ? "active" : "")}
                          onClick={() => setFilter(g)}
                        >
                          {g}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
              {isGrid ? (
                <section
                  className={
                    "catalog-page " + (isCategory ? "category-grid" : "")
                  }
                >
                  <div className="page-heading">
                    <span className="eyebrow">
                      {page === "list"
                        ? "SANA ÖZEL BİR KOLEKSİYON"
                        : "KİTAPLIĞINDAN KEŞFET"}
                    </span>
                    <div className="catalog-title">
                      <h1>
                        {page === "list"
                          ? "Listem"
                          : page === "new"
                            ? "Yeni Eklenenler"
                            : filter}
                      </h1>
                      <div className="sort-buttons">
                        {["Önerilen", "A–Z", "Puan", "Yıl"].map((s) => (
                          <button
                            key={s}
                            className={"chip " + (sort === s ? "active" : "")}
                            onClick={() => setSort(s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="muted">{pageItems.length} yapım</p>
                  </div>
                  {pageItems.length ? (
                    <div className="catalog-grid">
                      {pageItems.map((t) => (
                        <Card
                          key={t.id}
                          t={t}
                          onOpen={(id) => void openTitle(id)}
                          focusKey={"catalog-" + t.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Icon name="plus" size={64} />
                      <h2>Burada yerin hazır</h2>
                      <p>
                        Yapım ayrıntılarındaki + düğmesiyle favorilerini listene
                        ekle.
                      </p>
                      <button
                        className="white-btn"
                        onClick={() => navigate("home")}
                      >
                        Yapımları keşfet
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <>
                  {home?.hero && (
                    <Hero
                      t={home.hero}
                      onOpen={(id) => void openTitle(id)}
                      onPlay={(id) => void openTitle(id, true)}
                    />
                  )}
                  <div className="home-rows">
                    <Row
                      label="Kaldığın yerden devam et"
                      items={home?.continueWatching || []}
                      onOpen={(id) => void openTitle(id)}
                      id="continue"
                    />
                    <Row
                      label="Sıradaki favorin burada"
                      items={home?.recent || []}
                      onOpen={(id) => void openTitle(id)}
                      id="recent"
                    />
                    <Row
                      label="Kitaplığının en yüksek puanlı 10 yapımı"
                      items={(home?.topRated || []).slice(0, 10)}
                      onOpen={(id) => void openTitle(id)}
                      rank
                      id="rank"
                    />
                    {home?.genres.map((g, i) => (
                      <Row
                        key={g.genre}
                        label={g.genre}
                        items={g.items}
                        onOpen={(id) => void openTitle(id)}
                        id={"genre-" + i}
                      />
                    ))}
                    {!catalog.length && (
                      <div className="empty-state">
                        <h2>İlk hikâyeni ekle</h2>
                        <p>Pi’ye medya ekledikten sonra kitaplığını tara.</p>
                      </div>
                    )}
                    <div className="browse-footer">
                      <strong>KEREMFLIX</strong>
                      <span>Kendi kitaplığın. Kendi sineman.</span>
                      <span>
                        ← ↑ ↓ → Gezin &nbsp; · &nbsp; OK Seç &nbsp; · &nbsp;
                        Geri Dön
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {detail && !playback && (
        <DetailView
          key={detail.title.id}
          data={detail}
          onClose={closeDetail}
          onPlay={(ep, start = false) => setPlayback({ ep, start })}
          onOpen={(id) => void openTitle(id)}
          onList={list}
          notify={notify}
        />
      )}
      {detail && playback && (
        <Player
          detail={detail}
          initial={playback.ep}
          fromStart={playback.start}
          onClose={closePlayer}
          notify={notify}
        />
      )}
      {opening && (
        <div className="opening">
          <div className="spinner" />
          <span>Birazdan seninle…</span>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

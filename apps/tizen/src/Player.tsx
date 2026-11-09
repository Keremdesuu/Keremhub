import { useEffect, useRef, useState } from "react";
import { Engine } from "./engine.ts";
import type { Playback } from "./engine.ts";
import type { Detail, Episode } from "./types.ts";
import { preferences, persist } from "./api.ts";
import { time, moveFocus, trackLabel } from "./lib.ts";
import { Icon } from "./icons.tsx";
import { SubtitleSettings } from "./SubtitleSettings.tsx";
const empty: Playback = {
  ready: false,
  paused: false,
  position: 0,
  duration: 0,
  buffering: 0,
  tracks: [],
  audio: -1,
  subtitle: "off",
  text: "",
  speed: 1,
  muted: false,
  volume: 100,
  zoom: false,
  ended: false,
};
export function Player({
  detail,
  initial,
  fromStart,
  onClose: handleClose,
  notify,
}: {
  detail: Detail;
  initial: Episode;
  fromStart: boolean;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [ep, setEp] = useState(initial),
    [state, setState] = useState(empty),
    [controls, setControls] = useState(true),
    [panel, setPanel] = useState(""),
    [error, setError] = useState(""),
    [prefs, setPrefs] = useState(preferences),
    [remaining, setRemaining] = useState(10),
    [retry, setRetry] = useState(0);
  const engine = useRef<Engine | null>(null),
    hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    ui = useRef({ panel, controls, state });
  ui.current = { panel, controls, state };
  const idx = detail.episodes.findIndex((e) => e.id === ep.id),
    next = detail.episodes[idx + 1];
  function onClose() {
    engine.current?.close();
    handleClose();
  }
  function show() {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const s = ui.current;
      if (
        !s.panel &&
        !s.state.paused &&
        s.state.buffering === null &&
        !s.state.ended
      )
        setControls(false);
    }, 5000);
  }
  function action(fn: () => void) {
    try {
      fn();
      show();
    } catch (e) {
      notify(
        "Bu seçenek dosyada desteklenmiyor: " +
          String((e as Error).message || e),
      );
    }
  }
  function updatePref(p: Partial<typeof prefs>) {
    const next = { ...preferences(), ...p };
    persist(next);
    setPrefs(next);
  }
  function closePanel() {
    setPanel("");
    show();
    setTimeout(
      () =>
        document
          .querySelector<HTMLButtonElement>(".player-controls button")
          ?.focus(),
      0,
    );
  }
  useEffect(() => {
    const e = new Engine(
      document.getElementById("html-player") as HTMLVideoElement,
      setState,
      () => {
        setControls(true);
        setPanel("");
        setRemaining(10);
      },
      (message) => {
        setError(message);
        setControls(true);
      },
      notify,
    );
    engine.current = e;
    setError("");
    setPanel("");
    setControls(true);
    e.load(ep, ep.id !== initial.id || fromStart);
    show();
    const initialFocus = setTimeout(() => {
      if (document.activeElement?.closest(".player-layer")) return;
      document
        .querySelector<HTMLButtonElement>(".player-controls button")
        ?.focus();
    }, 100);
    const visibility = () => {
      if (document.hidden) e.pause(true);
      else show();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      e.close();
      clearTimeout(initialFocus);
      clearTimeout(hideTimer.current);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [ep.id, retry]);
  useEffect(() => {
    if (!panel) return;
    show();
    setTimeout(
      () =>
        document
          .querySelector<HTMLButtonElement>(".player-menu button")
          ?.focus(),
      20,
    );
  }, [panel]);
  useEffect(() => {
    if (!state.ended || !next || !prefs.autoplay || error) return;
    const timer = setInterval(() => setRemaining((n) => n - 1), 1000);
    return () => clearInterval(timer);
  }, [state.ended, next?.id, prefs.autoplay, error]);
  useEffect(() => {
    if (state.ended && remaining <= 0 && next && prefs.autoplay) setEp(next);
  }, [remaining]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const c = event.keyCode,
        e = engine.current;
      if (!e) return;
      if ([10009, 27, 461].includes(c)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (panel) closePanel();
        else onClose();
        return;
      }
      if ([415, 19, 10252, 413, 417, 412].includes(c)) {
        event.preventDefault();
        if (c === 413) onClose();
        else if (c === 417 || c === 412)
          action(() => e.skip(c === 417 ? 30 : -30));
        else
          action(() =>
            e.pause(c === 19 ? true : c === 415 ? false : !state.paused),
          );
        return;
      }
      if (
        document.activeElement?.getAttribute("role") === "slider" &&
        ![38, 40].includes(c)
      )
        return;
      if (!controls && [13, 37, 38, 39, 40].includes(c)) {
        event.preventDefault();
        if (c === 13) action(() => e.pause());
        else if (c === 37 || c === 39)
          action(() => e.skip(c === 37 ? -10 : 10));
        else {
          show();
          setTimeout(
            () =>
              document
                .querySelector<HTMLButtonElement>(".player-controls button")
                ?.focus(),
            0,
          );
        }
        return;
      }
      const dirs: Record<number, string> = {
        37: "left",
        38: "up",
        39: "right",
        40: "down",
      };
      if (dirs[c]) {
        event.preventDefault();
        show();
        moveFocus(
          dirs[c],
          document.querySelector(
            panel
              ? ".player-menu"
              : error
                ? ".playback-error"
                : ".player-layer",
          ),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [controls, panel, state.paused, error]);
  const b = (name: string, label: string, fn: () => void, disabled = false) => (
    <button
      className="control-icon"
      aria-label={label}
      title={label}
      onClick={() => action(fn)}
      disabled={disabled || !!state.busy}
    >
      <Icon name={name} size={36} />
      {name === "rewind" || name === "forward" ? <small>10</small> : null}
    </button>
  );
  const selected = (label: string, checked: boolean, fn: () => void) => (
    <button
      className={"menu-option " + (checked ? "selected" : "")}
      aria-pressed={checked}
      onClick={() => action(fn)}
    >
      <span>{label}</span>
      {checked && <Icon name="check" />}
    </button>
  );
  return (
    <div
      className={
        "player-layer " +
        (!controls && !panel && !error ? "controls-hidden" : "")
      }
      onMouseMove={show}
      aria-label="Video oynatıcı"
    >
      <div className="player-top">
        <button
          className="round"
          aria-label="Oynatıcıyı kapat"
          onClick={onClose}
        >
          <Icon name="back" size={34} />
        </button>
        <div>
          <span className="eyebrow">ŞİMDİ İZLİYORSUN</span>
          <h2>{detail.title.title}</h2>
          {detail.title.kind !== "MOVIE" && (
            <p>
              {ep.season}. sezon · {ep.number}. bölüm{" "}
              {ep.name ? " · " + ep.name : ""}
            </p>
          )}
        </div>
        <div className="player-brand">KEREMFLIX</div>
      </div>
      {state.buffering !== null && !error && (
        <div className="buffering">
          <div className="spinner" />
          <p>
            {state.ready ? "Yükleniyor" : "Sinema hazırlanıyor"}
            {state.buffering > 0 ? " · %" + state.buffering : ""}
          </p>
        </div>
      )}
      {error && (
        <div className="playback-error" role="alert">
          <Icon name="info" size={60} />
          <h2>Bir şeyler yolunda gitmedi</h2>
          <p>{error}</p>
          <div className="button-row">
            <button
              className="white-btn"
              onClick={() => setRetry((r) => r + 1)}
            >
              <Icon name="retry" />
              Tekrar dene
            </button>
            <button className="soft-btn" onClick={onClose}>
              Geri dön
            </button>
          </div>
        </div>
      )}
      {state.text && (
        <div
          className={
            "subtitle " + (prefs.subBackground ? "subtitle-background" : "")
          }
          style={{
            fontSize: prefs.subSize,
            top: Math.min(
              1080 -
                ((state.text.split("\n").length * prefs.subSize * 1.4) / 2 +
                  12),
              Math.max(
                (state.text.split("\n").length * prefs.subSize * 1.4) / 2 + 12,
                prefs.subPosition * 10.8,
              ),
            ),
          }}
        >
          <span>{state.text}</span>
        </div>
      )}
      {state.ended && (
        <div className="next-up">
          <span className="eyebrow">
            {next ? "SIRADAKİ BÖLÜM" : "İYİ SEYİRLERDİ"}
          </span>
          <h2>
            {next ? next.name || next.number + ". bölüm" : "İzleme tamamlandı"}
          </h2>
          {next && (
            <p>
              {next.season}. sezon · {next.number}. bölüm{" "}
              {prefs.autoplay
                ? " · " + remaining + " saniye içinde başlıyor"
                : ""}
            </p>
          )}
          <div className="button-row">
            {next && (
              <button className="white-btn" onClick={() => setEp(next)}>
                <Icon name="next" />
                Şimdi oynat
              </button>
            )}
            <button className="soft-btn" onClick={onClose}>
              Ayrıntılara dön
            </button>
          </div>
        </div>
      )}
      {!error && (
        <div className="player-bottom">
          <div className="timeline-head">
            <span>{time(state.position)}</span>
            <span className="muted">
              {state.duration
                ? time(Math.max(0, state.duration - state.position)) + " kaldı"
                : "Süre yükleniyor"}
            </span>
          </div>
          <div
            className="timeline"
            role="slider"
            aria-label="Oynatma konumu"
            aria-valuemin={0}
            aria-valuemax={Math.floor(state.duration)}
            aria-valuenow={Math.floor(state.position)}
            tabIndex={0}
            onClick={(ev) => {
              const r = ev.currentTarget.getBoundingClientRect();
              action(() =>
                engine.current?.seek(
                  ((ev.clientX - r.left) / r.width) * state.duration,
                ),
              );
            }}
            onKeyDown={(ev) => {
              if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
                ev.preventDefault();
                ev.stopPropagation();
                action(() =>
                  engine.current?.skip(ev.key === "ArrowLeft" ? -10 : 10),
                );
              } else if (ev.key === "Enter")
                action(() => engine.current?.pause());
            }}
          >
            <span className="timeline-track" />
            <span
              className="timeline-fill"
              style={{
                width:
                  (state.duration
                    ? (state.position / state.duration) * 100
                    : 0) + "%",
              }}
            />
            <span
              className="timeline-dot"
              style={{
                left:
                  (state.duration
                    ? (state.position / state.duration) * 100
                    : 0) + "%",
              }}
            />
          </div>
          <div className="player-controls">
            <div className="controls-group">
              {b(
                state.paused ? "play" : "pause",
                state.paused ? "Oynat" : "Duraklat",
                () => engine.current?.pause(),
                !state.ready,
              )}
              {b(
                "rewind",
                "10 saniye geri",
                () => engine.current?.skip(-10),
                !state.ready,
              )}
              {b(
                "forward",
                "10 saniye ileri",
                () => engine.current?.skip(10),
                !state.ready,
              )}
              {b(
                state.muted ? "mute" : "volume",
                state.muted ? "Sesi aç" : "Sesi kapat",
                () => engine.current?.mute(),
                !state.ready,
              )}
              <span className="control-title">
                {detail.title.kind === "MOVIE"
                  ? detail.title.title
                  : ep.season + ". sezon · " + ep.number + ". bölüm"}
              </span>
            </div>
            <div className="controls-group">
              {next && b("next", "Sonraki bölüm", () => setEp(next))}
              {detail.title.kind !== "MOVIE" &&
                b("episodes", "Bölümler", () => setPanel("episodes"))}
              {b(
                "subtitles",
                "Ses ve altyazı",
                () => setPanel("tracks"),
                !state.ready,
              )}
              {b(
                "speed",
                "Oynatma hızı",
                () => setPanel("speed"),
                !state.ready,
              )}
              {b("settings", "Oynatıcı ayarları", () => setPanel("settings"))}
              {b(
                "expand",
                state.zoom ? "Ekrana sığdır" : "Ekranı doldur",
                () => engine.current?.zoom(),
                !state.ready,
              )}
            </div>
          </div>
          <div className="player-help">
            <span>← → 10 saniye sar</span>
            <span>OK seç</span>
            <span>Geri kapat</span>
            <span className="engine-label">
              {engine.current?.native
                ? "SAMSUNG AVPLAY"
                : "TARAYICI ÖNİZLEMESİ"}
              {state.speed !== 1 ? " · " + state.speed + "×" : ""}
            </span>
          </div>
        </div>
      )}
      {panel && (
        <div className="menu-shade">
          <section
            className="player-menu"
            role="dialog"
            aria-label={
              panel === "tracks"
                ? "Ses ve altyazı"
                : panel === "episodes"
                  ? "Bölümler"
                  : panel === "speed"
                    ? "Oynatma hızı"
                    : "Oynatıcı ayarları"
            }
          >
            <div className="menu-header">
              <h2>
                {panel === "tracks"
                  ? "Ses ve altyazı"
                  : panel === "episodes"
                    ? "Bölümler"
                    : panel === "speed"
                      ? "Oynatma hızı"
                      : "Oynatıcı ayarları"}
              </h2>
              <button
                className="round"
                aria-label="Menüyü kapat"
                onClick={closePanel}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="menu-scroll">
              {panel === "tracks" && (
                <>
                  <h3>Ses dili</h3>
                  {state.tracks
                    .filter((t) => t.type === "AUDIO")
                    .map((t, i) => (
                      <div key={t.index}>
                        {selected(
                          trackLabel(t, i),
                          state.audio === t.index,
                          () => engine.current?.audio(t.index),
                        )}
                      </div>
                    ))}
                  {!state.tracks.some((t) => t.type === "AUDIO") && (
                    <p className="muted">Varsayılan ses parçası</p>
                  )}
                  <h3>Altyazı</h3>
                  {state.subtitleLoading && (
                    <p role="status" className="muted">
                      Gömülü altyazı hazırlanıyor…
                    </p>
                  )}
                  {selected("Kapalı", state.subtitle === "off", () =>
                    engine.current?.subtitle("off"),
                  )}
                  {!!engine.current?.cues.length &&
                    selected(
                      "Harici altyazı",
                      state.subtitle === "external",
                      () => engine.current?.subtitle("external"),
                    )}
                  {state.tracks
                    .filter((t) => t.type === "TEXT")
                    .map((t, i) => (
                      <div key={t.index}>
                        {selected(
                          trackLabel(t, i),
                          state.subtitle === "track:" + t.index,
                          () => engine.current?.subtitle("track:" + t.index),
                        )}
                      </div>
                    ))}
                  <p className="menu-note">
                    Ses ve altyazı seçenekleri dosyanın içerdiği parçalardır.
                  </p>
                  {!state.tracks.some((t) => t.type === "TEXT") && (
                    <p className="muted">
                      Bu videoda desteklenen gömülü altyazı bulunamadı.
                    </p>
                  )}
                  <SubtitleSettings prefs={prefs} update={updatePref} />
                </>
              )}
              {panel === "speed" && (
                <>
                  {(engine.current?.native
                    ? [1, 2, 4]
                    : [0.5, 0.75, 1, 1.25, 1.5, 2]
                  ).map((rate) => (
                    <div key={rate}>
                      {selected(
                        rate === 1 ? "Normal · 1×" : rate + "×",
                        state.speed === rate,
                        () => engine.current?.speed(rate),
                      )}
                    </div>
                  ))}
                  <p className="menu-note">
                    Hız desteği dosyaya ve oynatıcıya bağlıdır. Hızlandırılmış
                    oynatımda ses kesilebilir.
                  </p>
                </>
              )}
              {panel === "episodes" &&
                detail.episodes.map((e) => (
                  <button
                    key={e.id}
                    className={
                      "menu-option " + (e.id === ep.id ? "selected" : "")
                    }
                    onClick={() => {
                      setEp(e);
                      closePanel();
                    }}
                  >
                    <span>
                      <small>{e.season}. SEZON</small>
                      {e.number}. {e.name || "Bölüm"}
                    </span>
                    {e.id === ep.id && <Icon name="play" />}
                  </button>
                ))}
              {panel === "settings" && (
                <>
                  <SubtitleSettings prefs={prefs} update={updatePref} />
                  <h3>Altyazı gecikmesi · {prefs.subDelay.toFixed(1)} sn</h3>
                  <div className="button-row">
                    <button
                      className="soft-btn"
                      onClick={() =>
                        updatePref({
                          subDelay: Math.max(-10, prefs.subDelay - 0.5),
                        })
                      }
                    >
                      −0.5 sn
                    </button>
                    <button
                      className="soft-btn"
                      onClick={() => updatePref({ subDelay: 0 })}
                    >
                      Sıfırla
                    </button>
                    <button
                      className="soft-btn"
                      onClick={() =>
                        updatePref({
                          subDelay: Math.min(10, prefs.subDelay + 0.5),
                        })
                      }
                    >
                      +0.5 sn
                    </button>
                  </div>
                  <p className="menu-note">
                    Gecikme ayarı metne dönüştürülen gömülü ve harici
                    altyazılara uygulanır.
                  </p>
                  {selected(
                    "Sonraki bölümü otomatik oynat",
                    prefs.autoplay,
                    () => updatePref({ autoplay: !prefs.autoplay }),
                  )}
                  <h3>Ses · %{state.volume}</h3>
                  <div className="button-row">
                    <button
                      className="soft-btn"
                      onClick={() =>
                        action(() => engine.current?.volume(state.volume - 5))
                      }
                    >
                      −5
                    </button>
                    <button
                      className="soft-btn"
                      onClick={() =>
                        action(() => engine.current?.volume(state.volume + 5))
                      }
                    >
                      +5
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

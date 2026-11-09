import { preferences } from "./api.ts";
import { parseVTT, resume } from "./lib.ts";
import type { Cue, Episode, Track } from "./types.ts";
import { saveProgress } from "./progress.ts";
export interface Playback {
  busy?: boolean;
  ready: boolean;
  paused: boolean;
  position: number;
  duration: number;
  buffering: number | null;
  tracks: Track[];
  audio: number;
  subtitle: string;
  subtitleLoading?: boolean;
  text: string;
  speed: number;
  muted: boolean;
  volume: number;
  zoom: boolean;
  ended: boolean;
}
export class Engine {
  native = window.webapis?.avplay;
  video: HTMLVideoElement;
  state: Playback = {
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
  episode: Episode | null = null;
  cues: Cue[] = [];
  token = 0;
  closed = true;
  timer: ReturnType<typeof setInterval> | undefined;
  prepareTimer: ReturnType<typeof setTimeout> | undefined;
  abort = new AbortController();
  seeking = false;
  subtitleUserSelected = false;
  subtitleEndsAt = 0;
  embeddedTracks: Track[] = [];
  embeddedCues: Cue[] | null = null;
  subtitleRequest = 0;
  seekTarget: number | null = null;
  queuedSeek: number | null = null;
  seekTimer: ReturnType<typeof setTimeout> | undefined;
  onNotice: (message: string) => void;
  onChange: (s: Playback) => void;
  onEnd: () => void;
  onError: (e: string) => void;
  constructor(
    video: HTMLVideoElement,
    onChange: (s: Playback) => void,
    onEnd: () => void,
    onError: (e: string) => void,
    onNotice: (e: string) => void = () => {},
  ) {
    this.video = video;
    this.onChange = onChange;
    this.onEnd = onEnd;
    this.onError = onError;
    this.onNotice = onNotice;
  }
  emit() {
    if (!this.closed) this.onChange({ ...this.state });
  }
  load(ep: Episode, fromStart = false) {
    this.close();
    this.closed = false;
    this.episode = ep;
    const token = ++this.token;
    this.abort = new AbortController();
    this.subtitleUserSelected = false;
    this.subtitleEndsAt = 0;
    this.embeddedTracks = [];
    this.embeddedCues = null;
    ++this.subtitleRequest;
    this.seeking = false;
    this.seekTarget = this.queuedSeek = null;
    this.state = {
      ...this.state,
      ready: false,
      busy: false,
      paused: false,
      position: fromStart ? 0 : resume(ep),
      duration: ep.duration || 0,
      buffering: 0,
      tracks: [],
      subtitle: "off",
      subtitleLoading: false,
      text: "",
      speed: 1,
      zoom: false,
      ended: false,
    };
    this.cues = [];
    this.emit();
    document.body.classList.add("playing");
    document.body.classList.toggle("native-video", !!this.native);
    const url = preferences().server + "/api/stream/" + ep.id;
    const valid = () => !this.closed && token === this.token;
    fetch(preferences().server + "/api/tv/subtitles/" + ep.id, {
      signal: this.abort.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!valid() || !Array.isArray(data?.tracks) || !data.tracks.length)
          return;
        this.embeddedTracks = data.tracks;
        this.state.tracks = [
          ...this.state.tracks.filter((t) => t.type !== "TEXT"),
          ...this.embeddedTracks,
        ];
        this.emit();
      })
      .catch(() => {});
    const fail = (error: unknown) => {
      if (valid()) {
        clearTimeout(this.prepareTimer);
        this.state.buffering = null;
        this.state.paused = true;
        this.screensaver(true);
        this.emit();
        this.onError(String(error));
      }
    };
    this.prepareTimer = setTimeout(
      () => fail("Video hazırlanırken zaman aşımına uğradı."),
      35000,
    );
    fetch(preferences().server + "/api/subtitle/" + ep.id, {
      signal: this.abort.signal,
    })
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        if (valid()) {
          this.cues = parseVTT(text);
          if (this.cues.length && !this.subtitleUserSelected) {
            this.state.subtitle = "external";
            this.emit();
          }
        }
      })
      .catch(() => {});
    const prepared = () => {
      if (!valid() || this.state.ready) return;
      clearTimeout(this.prepareTimer);
      try {
        this.state.duration = this.native
          ? this.native.getDuration() / 1000
          : this.video.duration;
        if (!Number.isFinite(this.state.duration)) this.state.duration = 0;
        this.state.buffering = null;
        const at = Math.min(
          this.state.position,
          Math.max(0, this.state.duration - 1),
        );
        if (this.native) {
          this.native.play();
          // READY after prepareAsync is not a supported state for this API.
          // Optional subtitle control must never prevent the video from playing.
          try {
            this.native.setSilentSubtitle(true);
          } catch {}
          const started = () => {
            if (!valid()) return;
            this.readTracks();
            this.state.ready = true;
            this.screensaver(false);
            this.emit();
            this.timer = setInterval(() => this.save(), 15000);
          };
          if (at >= 20) this.nativeSeek(at, started, fail);
          else started();
          return;
        } else {
          this.video.currentTime = at;
          this.video.play().catch(fail);
        }
        this.state.ready = true;
        this.screensaver(false);
        this.emit();
        this.timer = setInterval(() => this.save(), 15000);
      } catch (e) {
        fail(e);
      }
    };
    const tick = (seconds: number) => {
      if (!valid()) return;
      if (this.seeking) return;
      this.state.position = seconds;
      if (this.state.subtitle === "external" || this.embeddedCues !== null) {
        const at = seconds - preferences().subDelay;
        this.state.text = (this.embeddedCues ?? this.cues)
          .filter((c) => at >= c.start && at < c.end)
          .map((c) => c.text)
          .join("\n");
      } else if (this.subtitleEndsAt && seconds >= this.subtitleEndsAt) {
        this.state.text = "";
        this.subtitleEndsAt = 0;
      }
      try {
        if (this.native && window.tizen?.tvaudiocontrol) {
          this.state.volume = window.tizen.tvaudiocontrol.getVolume();
          this.state.muted = window.tizen.tvaudiocontrol.isMute();
        }
      } catch {}
      this.emit();
    };
    const completed = () => {
      if (!valid() || this.state.ended) return;
      this.state.position = this.state.duration;
      this.state.ended = true;
      this.state.paused = true;
      this.state.text = "";
      this.save(true);
      this.emit();
      this.onEnd();
    };
    try {
      if (this.native) {
        this.native.open(url);
        this.native.setDisplayRect(0, 0, 1920, 1080);
        this.native.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX");
        this.native.setListener({
          onbufferingstart: () => {
            if (valid()) {
              this.state.buffering = 0;
              this.emit();
            }
          },
          onbufferingprogress: (p: number) => {
            if (valid()) {
              this.state.buffering = p;
              this.emit();
            }
          },
          onbufferingcomplete: () => {
            if (valid()) {
              this.state.buffering = null;
              this.emit();
            }
          },
          oncurrentplaytime: (ms: number) => tick(ms / 1000),
          onsubtitlechange: (duration: number | string, text: string) => {
            if (
              valid() &&
              this.embeddedCues === null &&
              this.state.subtitle.startsWith("track:")
            ) {
              const decoder = document.createElement("textarea");
              decoder.innerHTML = String(text || "")
                .replace(/<br\s*\/?\s*>/gi, "\n")
                .replace(/<[^>]*>/g, "");
              this.state.text = decoder.value;
              this.subtitleEndsAt =
                Number(duration) > 0
                  ? this.state.position + Number(duration) / 1000
                  : 0;
              this.emit();
            }
          },
          onstreamcompleted: completed,
          onerror: fail,
        });
        this.native.prepareAsync(prepared, fail);
      } else {
        this.video.src = url;
        this.video.onloadedmetadata = prepared;
        this.video.ontimeupdate = () => tick(this.video.currentTime);
        this.video.onended = completed;
        this.video.onerror = () =>
          fail(
            "Bu dosyanın codec’i tarayıcıda desteklenmiyor. Monitörde AVPlay ile açmayı dene.",
          );
        this.video.onwaiting = () => {
          if (valid()) {
            this.state.buffering = 0;
            this.emit();
          }
        };
        this.video.onplaying = () => {
          if (valid()) {
            this.state.buffering = null;
            this.emit();
          }
        };
        this.video.load();
      }
    } catch (e) {
      fail(e);
    }
  }
  readTracks() {
    if (!this.native) return;
    try {
      this.state.tracks = this.native.getTotalTrackInfo();
      if (this.embeddedTracks.length)
        this.state.tracks = [
          ...this.state.tracks.filter((t) => t.type !== "TEXT"),
          ...this.embeddedTracks,
        ];
      const audio = this.native
        .getCurrentStreamInfo()
        .find((t: Track) => t.type === "AUDIO");
      this.state.audio = audio?.index ?? -1;
    } catch {}
  }
  pause(paused = !this.state.paused) {
    if (!this.state.ready || this.state.ended || this.seeking) return;
    try {
      if (this.native) {
        if (paused) this.native.pause();
        else this.native.play();
      } else {
        if (paused) this.video.pause();
        else this.video.play().catch((e) => this.onError(String(e)));
      }
      this.state.paused = paused;
      if (paused) this.save();
      this.screensaver(paused);
      this.emit();
    } catch (e) {
      this.onError(String(e));
    }
  }
  nativeSeek(
    seconds: number,
    success: () => void = () => {},
    failure: (error: unknown) => void = (error) =>
      this.onNotice("Sarma yapılamadı: " + String(error)),
  ) {
    const token = this.token;
    const target = Math.min(
      Math.max(0.1, seconds),
      Math.max(0.1, this.state.duration - 1),
    );
    this.seeking = true;
    this.seekTarget = target;
    this.state.busy = true;
    this.state.text = "";
    this.subtitleEndsAt = 0;
    this.emit();
    const finish = (error?: unknown) => {
      if (this.closed || token !== this.token) return;
      clearTimeout(this.seekTimer);
      this.seeking = false;
      this.seekTarget = null;
      this.state.busy = false;
      this.state.buffering = null;
      // A requested target is not proof that the decoder actually moved.
      try {
        const actual = Number(this.native.getCurrentTime()) / 1000;
        if (Number.isFinite(actual)) this.state.position = Math.max(0, actual);
      } catch {}
      if (error) {
        this.queuedSeek = null;
        failure(error);
      } else {
        this.state.ended = false;
        success();
      }
      this.emit();
      const queued = this.queuedSeek;
      this.queuedSeek = null;
      if (queued !== null && !error) this.seek(queued);
    };
    this.seekTimer = setTimeout(() => {
      if (this.closed || token !== this.token) return;
      // Keep the operation locked: only the SDK callback proves it has ended.
      this.state.ready = false;
      this.onError(
        "Sarma işlemi tamamlanamadı. Tekrar dene seçeneğiyle videoyu yeniden aç.",
      );
      this.emit();
    }, 30000);
    try {
      this.native.seekTo(
        Math.round(target * 1000),
        () => finish(),
        (error: unknown) => finish(error),
      );
    } catch (error) {
      finish(error);
    }
  }
  seek(seconds: number) {
    if (!this.state.ready || !Number.isFinite(seconds)) return;
    if (this.seeking) {
      this.queuedSeek = seconds;
      return;
    }
    if (this.native) this.nativeSeek(seconds);
    else {
      this.video.currentTime = Math.min(
        Math.max(0, seconds),
        Math.max(0, this.state.duration - 1),
      );
      this.state.text = "";
    }
  }
  skip(delta: number) {
    this.seek(
      (this.queuedSeek ?? this.seekTarget ?? this.state.position) + delta,
    );
  }
  subtitle(value: string) {
    if (!this.state.ready || this.seeking) return;
    const track = this.state.tracks.find(
      (t) => t.type === "TEXT" && t.index === Number(value.slice(6)),
    );
    if (
      value.startsWith("track:") &&
      !this.state.tracks.some(
        (t) => t.type === "TEXT" && t.index === Number(value.slice(6)),
      )
    )
      throw Error("Bu altyazı parçası kullanılamıyor.");
    if (this.native) {
      if (value.startsWith("track:") && track?.source !== "server")
        this.native.setSelectTrack("TEXT", Number(value.slice(6)));
      this.native.setSilentSubtitle(true);
    }
    const request = ++this.subtitleRequest;
    this.embeddedCues =
      value.startsWith("track:") && track?.source === "server" ? [] : null;
    this.state.subtitleLoading = this.embeddedCues !== null;
    this.subtitleUserSelected = true;
    this.state.text = "";
    this.subtitleEndsAt = 0;
    this.state.subtitle = value;
    this.emit();
    if (this.embeddedCues !== null) {
      fetch(
        preferences().server +
          "/api/tv/subtitles/" +
          this.episode!.id +
          "/" +
          track!.index,
        { signal: this.abort.signal },
      )
        .then(async (r) => {
          if (!r.ok) throw Error("Altyazı hazırlanamadı. Tekrar seçmeyi dene.");
          return r.text();
        })
        .then((text) => {
          if (this.closed || request !== this.subtitleRequest) return;
          this.embeddedCues = parseVTT(text);
          if (!this.embeddedCues.length)
            throw Error("Bu altyazı parçasında metin bulunamadı.");
          this.state.subtitleLoading = false;
          this.emit();
        })
        .catch((error) => {
          if (this.closed || request !== this.subtitleRequest) return;
          this.state.subtitleLoading = false;
          this.state.subtitle = "off";
          this.embeddedCues = null;
          this.state.text = "";
          this.emit();
          this.onNotice(String(error.message || error));
        });
    }
  }
  audio(index: number) {
    if (!this.native || this.seeking || !this.state.ready) return;
    const paused = this.state.paused;
    try {
      if (paused) this.native.play();
      this.native.setSelectTrack("AUDIO", index);
      this.state.audio = index;
    } finally {
      if (paused) this.native.pause();
    }
    this.emit();
  }
  speed(value: number) {
    if (!this.state.ready || this.seeking) return;
    if (this.native) this.native.setSpeed(value);
    else this.video.playbackRate = value;
    this.state.speed = value;
    this.emit();
  }
  mute() {
    if (this.native) {
      const a = window.tizen?.tvaudiocontrol;
      if (!a) throw Error("Ses için monitör kumandasını kullan.");
      a.setMute(!a.isMute());
      this.state.muted = a.isMute();
    } else {
      this.video.muted = !this.video.muted;
      this.state.muted = this.video.muted;
    }
    this.emit();
  }
  volume(value: number) {
    value = Math.min(100, Math.max(0, value));
    if (this.native) {
      const a = window.tizen?.tvaudiocontrol;
      if (!a) throw Error("Ses için monitör kumandasını kullan.");
      a.setVolume(value);
    } else this.video.volume = value / 100;
    this.state.volume = value;
    this.emit();
  }
  zoom() {
    if (!this.state.ready || this.seeking) return;
    this.state.zoom = !this.state.zoom;
    if (this.native)
      this.native.setDisplayMethod(
        this.state.zoom
          ? "PLAYER_DISPLAY_MODE_FULL_SCREEN"
          : "PLAYER_DISPLAY_MODE_LETTER_BOX",
      );
    else this.video.style.objectFit = this.state.zoom ? "cover" : "contain";
    this.emit();
  }
  save(completed = false) {
    if (!this.episode || !this.state.ready || !this.state.duration) return;
    if (!this.seeking && !completed)
      try {
        const actual = this.native
          ? Number(this.native.getCurrentTime()) / 1000
          : this.video.currentTime;
        if (Number.isFinite(actual)) this.state.position = Math.max(0, actual);
      } catch {}
    const seconds = completed ? this.state.duration : this.state.position;
    this.episode.seconds = seconds;
    this.episode.duration = this.state.duration;
    saveProgress(this.episode, seconds, this.state.duration);
  }
  screensaver(on: boolean) {
    try {
      window.webapis?.appcommon?.setScreenSaver(on ? 1 : 0);
    } catch {}
  }
  close() {
    if (this.closed) return;
    if (!this.state.ended) this.save();
    this.closed = true;
    ++this.token;
    clearInterval(this.timer);
    clearTimeout(this.prepareTimer);
    clearTimeout(this.seekTimer);
    this.abort.abort();
    try {
      if (this.native) {
        this.native.stop();
        this.native.close();
      } else {
        this.video.onloadedmetadata =
          this.video.ontimeupdate =
          this.video.onended =
          this.video.onerror =
          this.video.onwaiting =
          this.video.onplaying =
            null;
        this.video.pause();
        this.video.removeAttribute("src");
        this.video.load();
      }
    } catch {}
    this.screensaver(true);
    document.body.classList.remove("playing", "native-video");
  }
}

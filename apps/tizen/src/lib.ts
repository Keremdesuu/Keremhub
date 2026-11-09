import type { Cue, Episode } from "./types.ts";
export function time(seconds: number) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return (h ? h + ":" + ("0" + m).slice(-2) : m) + ":" + ("0" + s).slice(-2);
}
export function resume(ep: Pick<Episode, "seconds" | "duration">) {
  if (!Number.isFinite(ep.seconds) || ep.seconds < 20) return 0;
  return ep.duration > 0 && ep.seconds / ep.duration >= 0.95
    ? 0
    : Math.max(0, ep.seconds || 0);
}
export function serverURL(value: string) {
  const url = new URL(value.trim());
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("Sunucu adresi http://IP:3210 biçiminde olmalı.");
  return url.origin;
}
export function parseVTT(source: string): Cue[] {
  const stamp = (s: string) =>
    s
      .replace(",", ".")
      .split(":")
      .reduce((n, p) => n * 60 + Number(p), 0);
  return source
    .replace(/\r/g, "")
    .replace(/^\uFEFF/, "")
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split("\n"),
        i = lines.findIndex((l) => l.includes("-->"));
      if (i < 0) return [];
      const p = lines[i].split(/\s+-->\s+/),
        start = stamp(p[0].trim()),
        end = stamp(p[1].trim().split(/\s/)[0]);
      return isFinite(start) && isFinite(end) && end > start
        ? [
            {
              start,
              end,
              text: lines
                .slice(i + 1)
                .join("\n")
                .replace(/<[^>]*>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&nbsp;/g, " "),
            },
          ]
        : [];
    });
}
type Rect = { left: number; top: number; width: number; height: number };
export function neighbor(
  current: Rect,
  candidates: { element: any; rect: Rect }[],
  direction: string,
) {
  const cx = current.left + current.width / 2,
    cy = current.top + current.height / 2;
  let best: any = null,
    score = Infinity;
  candidates.forEach((c) => {
    const r = c.rect,
      dx = r.left + r.width / 2 - cx,
      dy = r.top + r.height / 2 - cy,
      p =
        direction === "left"
          ? -dx
          : direction === "right"
            ? dx
            : direction === "up"
              ? -dy
              : dy,
      h = direction === "left" || direction === "right",
      s = h
        ? Math.max(
            0,
            current.top - r.top - r.height,
            r.top - current.top - current.height,
          )
        : Math.max(
            0,
            current.left - r.left - r.width,
            r.left - current.left - current.width,
          );
    if (p > 2 && p + s * 4 < score) {
      score = p + s * 4;
      best = c.element;
    }
  });
  return best;
}
const rowPositions = new WeakMap<Element, number>();
const playerControlFocus = new WeakMap<Element, HTMLElement>();
function rowTarget(
  direction: string,
  active: HTMLElement,
  scope: HTMLElement,
): HTMLElement | null | undefined {
  const player = active.closest<HTMLElement>(".player-layer");
  if (player && scope === player) {
    const controls = player.querySelector<HTMLElement>(".player-controls");
    const buttons = Array.from(
      player.querySelectorAll<HTMLElement>(
        ".player-controls button:not(:disabled)",
      ),
    );
    if (controls?.contains(active)) {
      playerControlFocus.set(controls, active);
      if (direction === "left" || direction === "right") {
        const target =
          buttons[buttons.indexOf(active) + (direction === "right" ? 1 : -1)] ||
          null;
        if (target) playerControlFocus.set(controls, target);
        return target;
      }
      return direction === "up"
        ? player.querySelector<HTMLElement>(".timeline")
        : null;
    }
    if (active.classList.contains("timeline")) {
      if (direction === "up")
        return player.querySelector<HTMLElement>(".player-top button");
      if (direction === "down") {
        const last = controls && playerControlFocus.get(controls);
        return last && buttons.includes(last) ? last : buttons[0] || null;
      }
      return null;
    }
    if (active.closest(".player-top"))
      return direction === "down"
        ? player.querySelector<HTMLElement>(".timeline")
        : null;
  }
  const rail = active.closest(".rail");
  if (rail && active.classList.contains("media-card")) {
    const cards = Array.from(rail.querySelectorAll<HTMLElement>(".media-card"));
    const index = cards.indexOf(active);
    rowPositions.set(rail, index);
    if (direction === "left" || direction === "right")
      return cards[index + (direction === "right" ? 1 : -1)] || null;
    const row = rail.closest(".content-row");
    const rows = Array.from(scope.querySelectorAll(".content-row"));
    const next = rows[rows.indexOf(row!) + (direction === "down" ? 1 : -1)];
    if (next) {
      const nextRail = next.querySelector(".rail")!;
      const nextCards = Array.from(
        nextRail.querySelectorAll<HTMLElement>(".media-card"),
      );
      return (
        nextCards[
          Math.min(rowPositions.get(nextRail) ?? index, nextCards.length - 1)
        ] || null
      );
    }
    if (direction === "up") {
      const episodes = scope.querySelectorAll<HTMLElement>(
        ".episode-list .episode",
      );
      return (
        episodes[episodes.length - 1] ||
        scope.querySelector<HTMLElement>(".hero .white-btn") ||
        scope.querySelector<HTMLElement>(".detail-hero .white-btn") ||
        scope.querySelector<HTMLElement>("nav .active")
      );
    }
    return null;
  }
  if (active.closest(".hero") && direction === "down")
    return scope.querySelector<HTMLElement>(".content-row .media-card");
  if (active.closest(".hero") && direction === "up")
    return scope.querySelector<HTMLElement>("nav .active");
  if (active.closest("header") && direction === "up") return null;
  if (active.closest("header") && direction === "down")
    return (
      scope.querySelector<HTMLElement>(".hero .white-btn") ||
      scope.querySelector<HTMLElement>("main button,main input")
    );
  if (
    active.tagName === "INPUT" &&
    direction === "down" &&
    active.closest(".search-tools")
  )
    return scope.querySelector<HTMLElement>(".keyboard button");
  const grid = active.closest(".catalog-grid,.search-grid,.keyboard");
  if (grid) {
    const selector = grid.classList.contains("keyboard")
      ? "button"
      : ".media-card";
    const cells = Array.from(grid.querySelectorAll<HTMLElement>(selector));
    const index = cells.indexOf(active),
      columns = grid.classList.contains("keyboard")
        ? 6
        : grid.classList.contains("search-grid")
          ? 3
          : 5;
    if (direction === "up" && index < columns)
      return grid.classList.contains("keyboard")
        ? scope.querySelector<HTMLElement>(".search-input input")
        : scope.querySelector<HTMLElement>(".sort-buttons .active") ||
            scope.querySelector<HTMLElement>("nav .active");
    const delta =
      direction === "left"
        ? -1
        : direction === "right"
          ? 1
          : direction === "up"
            ? -columns
            : columns;
    const target = cells[index + delta];
    if (target) return target;
  }
  const episodes = active.closest(".episode-list");
  if (episodes) {
    const cells = Array.from(
        episodes.querySelectorAll<HTMLElement>(".episode"),
      ),
      index = cells.indexOf(active);
    if (direction === "up")
      return (
        cells[index - 1] ||
        scope.querySelector<HTMLElement>(".season-tabs .active")
      );
    if (direction === "down")
      return (
        cells[index + 1] ||
        scope.querySelector<HTMLElement>(".content-row .media-card")
      );
  }
  if (active.closest(".season-tabs") && direction === "down")
    return scope.querySelector<HTMLElement>(".episode-list .episode");
  return undefined;
}
function revealTarget(target: HTMLElement) {
  // Never scroll hidden outer containers: scrollIntoView also scrolls the stage.
  if (target.closest("header") || target.closest(".hero")) {
    const browse = target.closest(".browse");
    const main = browse?.querySelector<HTMLElement>(".main-scroll");
    if (main) main.scrollTop = 0;
    document
      .querySelectorAll<HTMLElement>(".browse,.stage,#root")
      .forEach((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    return;
  }
  if (target.closest(".detail-hero")) {
    const detail = target.closest<HTMLElement>(".detail-scroll");
    if (detail) detail.scrollTop = 0;
    return;
  }
  const rect = target.getBoundingClientRect(),
    rail = target.closest<HTMLElement>(".rail");
  if (rail) {
    const bounds = rail.getBoundingClientRect();
    const scale = bounds.width / rail.clientWidth || 1;
    if (rect.left < bounds.left + 16 * scale)
      rail.scrollLeft += (rect.left - bounds.left) / scale - 16;
    else if (rect.right > bounds.right - 16 * scale)
      rail.scrollLeft += (rect.right - bounds.right) / scale + 16;
  }
  const scroller = target.closest<HTMLElement>(
    ".main-scroll,.detail-scroll,.menu-scroll",
  );
  if (scroller) {
    const bounds = scroller.getBoundingClientRect();
    const scale = bounds.height / scroller.clientHeight || 1;
    const topPadding = scroller.classList.contains("with-hero") ? 126 : 16;
    if (rect.top < bounds.top + topPadding * scale) {
      const row = target.closest(".content-row");
      const top = row ? row.getBoundingClientRect().top : rect.top;
      scroller.scrollTop += (top - bounds.top) / scale - topPadding;
    } else if (rect.bottom > bounds.bottom - 24 * scale)
      scroller.scrollTop += (rect.bottom - bounds.bottom) / scale + 24;
  }
}
export function moveFocus(direction: string, scope: HTMLElement | null) {
  if (!scope) return;
  const active = document.activeElement as HTMLElement;
  if (active.closest("header")) revealTarget(active);
  if (scope.contains(active)) {
    const fast = rowTarget(direction, active, scope);
    if (fast !== undefined) {
      if (fast) {
        fast.focus({ preventScroll: true });
        revealTarget(fast);
      }
      return;
    }
  }
  const els = Array.from(
    scope.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select,[tabindex="0"]',
    ),
  ).filter(
    (el) => !!el.getClientRects().length && !el.closest('[aria-hidden="true"]'),
  );
  if (!scope.contains(active)) {
    els[0]?.focus();
    return;
  }
  const target = neighbor(
    active.getBoundingClientRect(),
    els
      .filter((el) => el !== active)
      .map((element) => ({ element, rect: element.getBoundingClientRect() })),
    direction,
  );
  if (target) {
    target.focus({ preventScroll: true });
    revealTarget(target);
  }
}
export function trackLabel(track: { extra_info: string }, i: number) {
  try {
    const info = JSON.parse(track.extra_info || "{}"),
      lang = info.language || info.track_lang || info.Language;
    const names: Record<string, string> = {
      tur: "Türkçe",
      tr: "Türkçe",
      eng: "İngilizce",
      en: "İngilizce",
      jpn: "Japonca",
      ja: "Japonca",
      kor: "Korece",
      ko: "Korece",
      deu: "Almanca",
      fra: "Fransızca",
    };
    return (
      (names[lang] || lang || "Parça " + (i + 1)) +
      (info.channels ? " · " + info.channels + " kanal" : "") +
      (info.title ? " · " + info.title : "") +
      (info.forced ? " · Zorunlu" : "")
    );
  } catch {
    return "Parça " + (i + 1);
  }
}

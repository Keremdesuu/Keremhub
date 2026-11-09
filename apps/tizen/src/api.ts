import type { Preferences } from "./types.ts";
export const defaults: Preferences = {
  server: "http://192.168.1.240:3210",
  autoplay: true,
  subSize: 38,
  subBackground: true,
  subPosition: 90,
  subDelay: 0,
};
export function preferences(): Preferences {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem("keremflix.preferences") || "{}"),
      server: localStorage.getItem("keremflix.server") || defaults.server,
    };
  } catch {
    return defaults;
  }
}
export function persist(value: Preferences) {
  localStorage.setItem("keremflix.preferences", JSON.stringify(value));
  localStorage.setItem("keremflix.server", value.server);
}
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const c = new AbortController(),
    timer = setTimeout(() => c.abort(), 15000);
  const abort = () => c.abort();
  signal?.addEventListener("abort", abort);
  try {
    const r = await fetch(preferences().server + path, {
      signal: c.signal,
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw Error("Sunucu yanıtı: " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export function image(t: { id: number }, role = "card") {
  return preferences().server + "/api/artwork/" + t.id + "/" + role;
}

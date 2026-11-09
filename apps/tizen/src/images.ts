// Decode nearby artwork during idle time, one bitmap at a time. No React updates.
const decoded = new Set<string>();
const pending = new Set<string>();
const queue: HTMLImageElement[] = [];
let running = false;
function drain() {
  const image = queue.shift();
  if (!image) {
    running = false;
    return;
  }
  const url = image.currentSrc || image.src;
  if (!image.isConnected) {
    pending.delete(url);
    drain();
    return;
  }
  image
    .decode()
    .then(() => decoded.add(url))
    .catch(() => {})
    .finally(() => {
      pending.delete(url);
      schedule();
    });
}
function schedule() {
  if ("requestIdleCallback" in window)
    window.requestIdleCallback(drain, { timeout: 1200 });
  else setTimeout(drain, 80);
}
export function warmArtwork(image: HTMLImageElement) {
  if (!window.tizen || typeof image.decode !== "function") return;
  const url = image.currentSrc || image.src;
  if (decoded.has(url) || pending.has(url)) return;
  const bounds = image.getBoundingClientRect();
  if (bounds.top > window.innerHeight + 900 || bounds.bottom < -900) return;
  pending.add(url);
  queue.push(image);
  if (!running) {
    running = true;
    schedule();
  }
}

import { createHash, randomBytes } from "node:crypto";
export function shuffleSeed(value?: string): string {
  return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : randomBytes(12).toString("hex");
}
/** Stable Fisher–Yates order for pagination; never mutates the input. */
export function shuffled<T>(values: readonly T[], seed: string): T[] {
  const out = [...values];
  let state = createHash("sha256").update(seed).digest().readUInt32LE(0) || 1;
  function random() { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

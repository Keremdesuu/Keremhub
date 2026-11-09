export class MetadataRequestError extends Error { constructor(public status:number){super(`Metadata source unavailable (${status||"network"})`);this.name="MetadataRequestError";} }
export async function getJson<T>(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<T | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (res.status===401||res.status===403||res.status===429||res.status>=500)throw new MetadataRequestError(res.status);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch(error) {
    if(error instanceof MetadataRequestError)throw error;
    throw new MetadataRequestError(0);
  } finally {
    clearTimeout(t);
  }
}

export const stripHtml = (s?: string | null) =>
  s ? s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim() : null;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

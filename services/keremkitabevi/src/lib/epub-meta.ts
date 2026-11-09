import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import path from "node:path";

export type EpubMeta = {
  title?: string;
  authors: string[];
  subjects: string[];
  language?: string;
  publisher?: string;
  year?: number;
  description?: string;
  series?: string;
  seriesIndex?: number;
  cover?: Buffer;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  textNodeName: "#text",
  trimValues: true,
});

const arr = <T,>(v: T | T[] | undefined): T[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

function text(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string" || typeof v === "number") return String(v).trim() || undefined;
  if (typeof v === "object" && "#text" in (v as object)) return text((v as Record<string, unknown>)["#text"]);
  return undefined;
}

function stripHtml(s: string) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function readEntry(zip: AdmZip, name: string): Buffer | null {
  const clean = decodeURIComponent(name).replace(/^\/+/, "");
  const entry = zip.getEntry(clean) ?? zip.getEntry(name);
  return entry ? entry.getData() : null;
}

export function readEpubMeta(file: string): EpubMeta {
  const zip = new AdmZip(file);
  const container = readEntry(zip, "META-INF/container.xml");
  if (!container) throw new Error("container.xml yok");
  const c = parser.parse(container.toString("utf8"));
  const rootfile = arr(c?.container?.rootfiles?.rootfile)[0];
  const opfPath: string | undefined = rootfile?.["@_full-path"];
  if (!opfPath) throw new Error("OPF yolu bulunamadı");
  const opfBuf = readEntry(zip, opfPath);
  if (!opfBuf) throw new Error("OPF okunamadı");
  const opf = parser.parse(opfBuf.toString("utf8"));
  const pkg = opf.package ?? {};
  const md = pkg.metadata ?? {};
  const opfDir = path.posix.dirname(opfPath);

  const authors = arr(md.creator).map(text).filter((x): x is string => !!x);
  const subjects = arr(md.subject).map(text).filter((x): x is string => !!x);
  const dateStr = text(arr(md.date)[0]);
  const year = dateStr?.match(/\d{4}/)?.[0];
  const desc = text(arr(md.description)[0]);

  const metas = arr<Record<string, unknown>>(md.meta);
  const metaByName = (n: string) => metas.find((m) => m["@_name"] === n);
  let series = text(metaByName("calibre:series")?.["@_content"]);
  let seriesIndex = Number(text(metaByName("calibre:series_index")?.["@_content"]));
  if (!series) {
    const coll = metas.find((m) => m["@_property"] === "belongs-to-collection");
    series = text(coll);
    const id = coll?.["@_id"];
    if (id) {
      const pos = metas.find((m) => m["@_refines"] === `#${id}` && m["@_property"] === "group-position");
      seriesIndex = Number(text(pos));
    }
  }

  // Kapak: önce calibre/EPUB2 "cover" meta, sonra EPUB3 cover-image
  const manifest = arr<Record<string, string>>(pkg.manifest?.item);
  const coverId = metaByName("cover")?.["@_content"] as string | undefined;
  const coverItem =
    manifest.find((i) => i["@_properties"]?.split(/\s+/).includes("cover-image")) ??
    (coverId ? manifest.find((i) => i["@_id"] === coverId) : undefined) ??
    manifest.find((i) => /cover/i.test(i["@_id"] ?? "") && /^image\//.test(i["@_media-type"] ?? ""));
  let cover: Buffer | undefined;
  if (coverItem?.["@_href"]) {
    const href = path.posix.normalize(path.posix.join(opfDir, decodeURIComponent(coverItem["@_href"])));
    cover = readEntry(zip, href) ?? undefined;
  }

  return {
    title: text(arr(md.title)[0]),
    authors,
    subjects,
    language: text(arr(md.language)[0]),
    publisher: text(arr(md.publisher)[0]),
    year: year ? Number(year) : undefined,
    description: desc ? stripHtml(desc).slice(0, 4000) : undefined,
    series,
    seriesIndex: Number.isFinite(seriesIndex) ? seriesIndex : undefined,
    cover,
  };
}

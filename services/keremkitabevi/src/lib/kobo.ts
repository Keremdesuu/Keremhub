import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/db";
import { BASE_PATH } from "@/lib/config";

export async function getKoboToken() {
  const found = await db.koboConfig.findUnique({ where: { id: 1 } });
  if (found) return found.token;
  try {
    return (await db.koboConfig.create({ data: { id: 1, token: randomBytes(32).toString("hex") } })).token;
  } catch {
    const raced = await db.koboConfig.findUnique({ where: { id: 1 } });
    if (raced) return raced.token;
    throw new Error("Kobo kurulumu başlatılamadı");
  }
}
export async function validKoboToken(token: string) {
  const config = await db.koboConfig.findUnique({ where: { id: 1 } });
  return Boolean(config && config.token === token);
}
export function bookUuid(id: number) {
  return "00000000-0000-4000-8000-" + id.toString(16).padStart(12, "0");
}
export function idFromBookUuid(value: string) {
  const match = /^00000000-0000-4000-8000-([0-9a-f]{12})$/i.exec(value);
  if (!match) return null;
  const id = Number.parseInt(match[1], 16);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
type BookMeta = {
  id:number; updatedAt:Date; title:string; description:string|null; language:string|null; publisher:string|null;
  year:number|null; addedAt:Date; sizeBytes:number; format:string; seriesIndex:number|null;
  author:{name:string}|null; series:{name:string}|null;
};
export function koboLanguage(value:string|null) {
 const raw=(value||"en").trim().toLowerCase();
 const names:Record<string,string>={"türkçe":"tr","turkce":"tr","tur":"tr","english":"en","eng":"en","ingilizce":"en","deutsch":"de","almanca":"de","german":"de","deu":"de","ger":"de","français":"fr","fransızca":"fr","fra":"fr","fre":"fr","español":"es","spa":"es"};
 return names[raw]||(/^[a-z]{2}(?:[-_][a-z]{2})?$/.test(raw)?raw.replace("_","-"):"en");
}
export function seriesUuid(name:string) {
 const h=createHash("sha256").update("keremkitabevi:series:"+name.normalize("NFC")).digest("hex");
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function koboMetadata(book:BookMeta, siteRoot:string, download?:{url:string;format:string;size:number}) {
  const uuid=bookUuid(book.id), format=book.format==="kepub"?"KEPUB":book.format.toUpperCase();
  const authors=book.author?.name ? book.author.name.split(/,\s*/).filter(Boolean) : [];
  const date=book.year ? new Date(Date.UTC(book.year,0,1)) : book.addedAt;
  const metadata:any={
    Categories:[], CoverImageId:`${book.id}-${book.updatedAt.getTime()}`, CrossRevisionId:uuid,
    CurrentDisplayPrice:{CurrencyCode:"USD",TotalAmount:0}, CurrentLoveDisplayPrice:{TotalAmount:0},
    Description:book.description, DownloadUrls:[{Format:download?.format||format,Size:download?.size??book.sizeBytes,Url:download?.url||(siteRoot+BASE_PATH+"/api/books/"+book.id+"/file?download=1"),Platform:"Generic"}],
    EntitlementId:uuid, ExternalIds:[], Genre:"", IsEligibleForKoboLove:false, IsInternetArchive:false,
    IsPreOrder:false, IsSocialEnabled:false, Language:koboLanguage(book.language),
    PhoneticPronunciations:{}, PublicationDate:date.toISOString(), Publisher:{Imprint:"",Name:book.publisher||""},
    RevisionId:uuid, Title:book.title, WorkId:uuid, Contributors:authors,
    ContributorRoles:authors.map(Name=>({Name})),
  };
  if(book.series?.name) metadata.Series={Name:book.series.name,Number:book.seriesIndex??1,NumberFloat:book.seriesIndex??1,Id:seriesUuid(book.series.name)};
  return metadata;
}
export function tokenFromHeaders(header:string|null) {
  const empty={modified:new Date(0),lastId:0,created:0,reading:0,readingLastId:0,archived:0,tags:0};
  if(!header||header.includes("."))return empty;
  try{
    const parsed=JSON.parse(Buffer.from(header,"base64").toString("utf8")),d=parsed.data;
    if(parsed.version!=="2-0-0")return empty;
    if(!d||!Number.isFinite(Number(d.books_last_modified)))return empty;
    return {
      modified:new Date(Number(d.books_last_modified)*1000),
      lastId:Number.isSafeInteger(Number(d.last_id))?Number(d.last_id):0,
      created:Number(d.books_last_created)||0,
      reading:Number(d.reading_state_last_modified)||0,
      readingLastId:Number.isSafeInteger(Number(d.reading_last_id))?Number(d.reading_last_id):0,
      archived:Number(d.archive_last_modified)||0,
      tags:Number(d.tags_last_modified)||0,
    };
  }catch{return empty;}
}
export function makeSyncToken(s:{modified:Date;lastId:number;created:number;reading:number;readingLastId?:number;archived:number;tags:number}) {
  return Buffer.from(JSON.stringify({version:"2-0-0",data:{
    raw_kobo_store_token:"",books_last_modified:s.modified.getTime()/1000,
    books_last_created:s.created,archive_last_modified:s.archived,
    reading_state_last_modified:s.reading,reading_last_id:s.readingLastId||0,tags_last_modified:s.tags,last_id:s.lastId,
  }})).toString("base64");
}
export function koboPublicOrigin(req: Request) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = (forwardedHost || req.headers.get("host"))?.split(",")[0]?.trim();
  if (!host) return new URL(req.url).origin;
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || "http";
  try { return new URL(`${protocol}://${host}`).origin; }
  catch { return new URL(req.url).origin; }
}

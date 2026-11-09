import {NextResponse} from "next/server";
import {db} from "@/lib/db";
import {BASE_PATH} from "@/lib/config";
import {bookUuid,koboMetadata,koboPublicOrigin,makeSyncToken,tokenFromHeaders,validKoboToken} from "@/lib/kobo";
import {prepareKoboFile} from "@/lib/kobo-files";
import {koboReadingState,readingModified} from "@/lib/kobo-reading";
export const dynamic="force-dynamic";
const stamp=(d:Date)=>d.toISOString().replace(/\.\d{3}Z$/,"Z");
export async function GET(req:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!(await validKoboToken(token)))return new Response("Not found",{status:404});
 const prior=tokenFromHeaders(req.headers.get("x-kobo-synctoken")),origin=koboPublicOrigin(req);
 const library=await db.book.findMany({where:{OR:[{koboSync:true},{koboState:{isNot:null}}]},include:{author:true,series:true,progress:true,entry:true,koboState:true}});
 const newer=library.filter(b=>b.updatedAt>prior.modified||(b.updatedAt.getTime()===prior.modified.getTime()&&b.id>prior.lastId)).sort((a,b)=>a.updatedAt.getTime()-b.updatedAt.getTime()||a.id-b.id);
 // A cursor acknowledges metadata, not a completed transfer. Retry undownloaded books
 // after the current metadata page, without producing endless continuation pages.
 const retry=library.filter(b=>b.koboSync&&!b.koboState?.downloadedAt).sort((a,b)=>a.updatedAt.getTime()-b.updatedAt.getTime()||a.id-b.id);
 const batch=(newer.length?newer:retry).slice(0,100),included=new Set(batch.map(b=>b.id));
 let modified=prior.modified,lastId=prior.lastId,created=prior.created,reading=prior.reading,readingLastId=prior.readingLastId,readingMore=false;
 const results:unknown[]=[];
 for(const b of batch){
  const uuid=bookUuid(b.id),removed=!b.koboSync;
  let download:undefined|{url:string;format:string;size:number};
  if(!removed){
   try{const f=await prepareKoboFile(b);download={url:origin+BASE_PATH+"/kobo/"+token+"/download/"+b.id,format:f.format,size:f.unpackedSize};}
   catch(error){console.error(JSON.stringify({event:"kobo.prepare.failed",bookId:b.id,error:String(error)}));return NextResponse.json({error:"Kitap Kobo için hazırlanamadı"},{status:503,headers:{"Cache-Control":"no-store"}});}
  }
  const entitlement={Accessibility:"Full",ActivePeriod:{From:stamp(b.addedAt)},Created:stamp(b.addedAt),CrossRevisionId:uuid,Id:uuid,IsRemoved:removed,IsHiddenFromArchive:false,IsLocked:false,LastModified:stamp(b.updatedAt),OriginCategory:"Imported",RevisionId:uuid,Status:"Active"};
  results.push({[!removed&&!b.koboState?.downloadedAt?"NewEntitlement":"ChangedEntitlement"]:{BookEntitlement:entitlement,BookMetadata:koboMetadata(b,origin,download),ReadingState:koboReadingState(b)}});
  if(b.updatedAt>modified||(b.updatedAt.getTime()===modified.getTime()&&b.id>lastId)){modified=b.updatedAt;lastId=b.id;}
  created=Math.max(created,b.addedAt.getTime()/1000);
 }
 // Keep a separate cursor for reading changes so page/metadata cursors cannot hide them.
 const changes=library.filter(b=>b.koboSync&&(readingModified(b).getTime()/1000>prior.reading||(readingModified(b).getTime()/1000===prior.reading&&b.id>prior.readingLastId))).sort((a,b)=>readingModified(a).getTime()-readingModified(b).getTime()||a.id-b.id);
 let readingCount=0;
 for(const b of changes){
  if(!included.has(b.id)){if(readingCount>=100){readingMore=true;break;}results.push({ChangedReadingState:{ReadingState:koboReadingState(b)}});readingCount++;}
  reading=readingModified(b).getTime()/1000;readingLastId=b.id;
 }
 // No persistent "synced" write occurs here. Only the completed download endpoint records transfer.
 const deletions=await db.koboDeletion.findMany({where:{id:{gt:prior.archived}},orderBy:{id:"asc"},take:101});
 const removedPage=deletions.slice(0,100);
 results.push(...removedPage.map(item=>JSON.parse(item.payload)));
 const archived=removedPage.at(-1)?.id??prior.archived;
 const response=NextResponse.json(results,{headers:{"Cache-Control":"no-store"}});
 response.headers.set("x-kobo-apitoken","e30=");response.headers.set("x-kobo-sync-mode","delta");
 response.headers.set("x-kobo-synctoken",makeSyncToken({...prior,modified,lastId,created,reading,readingLastId,archived}));
 if(newer.length>batch.length||readingMore||deletions.length>100)response.headers.set("x-kobo-sync","continue");
 console.info(JSON.stringify({event:"kobo.sync",metadata:batch.length,reading:readingCount,retries:!newer.length?batch.length:0}));
 return response;
}

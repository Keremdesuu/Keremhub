import {koboReadingState} from "@/lib/kobo-reading";
import {NextResponse} from "next/server";
import {db} from "@/lib/db";
import {bookUuid,idFromBookUuid,validKoboToken} from "@/lib/kobo";
export const dynamic="force-dynamic";
const stamp=(d:Date)=>d.toISOString().replace(/\.\d{3}Z$/,"Z");
const status=(s:string|null|undefined)=>s==="read"?"Finished":s==="reading"?"Reading":"ReadyToRead";
async function load(id:number){
 return db.book.findUnique({where:{id},include:{progress:true,entry:true}});
}
const response=koboReadingState;
export async function GET(_req:Request,{params}:{params:Promise<{token:string;uuid:string}>}){
 const {token,uuid}=await params;if(!(await validKoboToken(token)))return new Response("Not found",{status:404});
 const id=idFromBookUuid(uuid);if(!id)return new Response("Not found",{status:404});const b=await load(id);if(!b)return new Response("Not found",{status:404});
 return NextResponse.json([response(b)]);
}
export async function PUT(req:Request,{params}:{params:Promise<{token:string;uuid:string}>}){
 const {token,uuid}=await params;if(!(await validKoboToken(token)))return new Response("Not found",{status:404});
 const id=idFromBookUuid(uuid);if(!id)return NextResponse.json({RequestResult:"Success",UpdateResults:[]});
 const body=await req.json().catch(()=>null),item=body?.ReadingStates?.[0];if(!item)return NextResponse.json({error:"Invalid reading state"},{status:400});
 const book=await load(id);if(!book)return NextResponse.json({RequestResult:"Success",UpdateResults:[]});
 const raw=Number(item.CurrentBookmark?.ProgressPercent),percent=Number.isFinite(raw)?Math.max(0,Math.min(100,raw))/100:book.progress?.percent??0;
 const loc=item.CurrentBookmark?.Location;
 const koboLocation=loc&&typeof loc.Value==="string"&&typeof loc.Type==="string"&&typeof loc.Source==="string"&&JSON.stringify(loc).length<=8192?JSON.stringify(loc):undefined;
 await db.progress.upsert({where:{bookId:id},create:{bookId:id,location:"",percent,koboLocation},update:{percent,...(koboLocation!==undefined?{koboLocation}:{})}});
 const code=item.StatusInfo?.Status,now=new Date();
 if(code==="Finished")await db.readingEntry.upsert({where:{bookId:id},create:{bookId:id,status:"read",finishedAt:now},update:{status:"read",finishedAt:now}});
 else if(code==="Reading")await db.readingEntry.upsert({where:{bookId:id},create:{bookId:id,status:"reading",startedAt:now},update:{status:"reading",startedAt:book.entry?.startedAt??now}});
 const updated=await load(id);return NextResponse.json({RequestResult:"Success",UpdateResults:[{EntitlementId:uuid,LastModified:stamp(updated!.progress?.updatedAt??now),PriorityTimestamp:stamp(updated!.progress?.updatedAt??now)}]});
}
import {prepareKoboFile} from "@/lib/kobo-files";
import {NextResponse} from "next/server";
import {db} from "@/lib/db";
import {BASE_PATH} from "@/lib/config";
import {idFromBookUuid,koboMetadata,koboPublicOrigin,validKoboToken} from "@/lib/kobo";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{token:string;uuid:string}>}){
 const {token,uuid}=await params;if(!(await validKoboToken(token)))return new Response("Not found",{status:404});
 const id=idFromBookUuid(uuid);if(!id)return new Response("Not found",{status:404});
 const book=await db.book.findUnique({where:{id},include:{author:true,series:true,genres:true}});
 if(!book)return new Response("Not found",{status:404});
 const file=await prepareKoboFile(book);
 return NextResponse.json([koboMetadata(book,koboPublicOrigin(req),{url:koboPublicOrigin(req)+BASE_PATH+"/kobo/"+token+"/download/"+book.id,format:file.format,size:file.unpackedSize})]);
}
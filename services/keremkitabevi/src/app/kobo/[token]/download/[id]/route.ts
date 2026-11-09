import fs from "node:fs";
import {Readable} from "node:stream";
import {db} from "@/lib/db";
import {validKoboToken} from "@/lib/kobo";
import {prepareKoboFile} from "@/lib/kobo-files";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{token:string;id:string}>}){
 const {token,id}=await params;
 if(!(await validKoboToken(token)))return new Response("Not found",{status:404});
 const n=Number(id);if(!/^\d+$/.test(id)||!Number.isSafeInteger(n)||n<1)return new Response("Invalid id",{status:400});
 const book=await db.book.findUnique({where:{id:n}});if(!book||!book.koboSync)return new Response("Not found",{status:404});
 const file=await prepareKoboFile(book),headers=new Headers({"Content-Type":file.format==="PDF"?"application/pdf":"application/epub+zip","Accept-Ranges":"bytes","Cache-Control":"no-store","Content-Disposition":`attachment; filename="book-${n}.${file.format==="PDF"?"pdf":"kepub.epub"}"`});
 let start=0,end=file.size-1,status=200;
 const raw=req.headers.get("range");
 if(raw){
  const range=/^bytes=(\d*)-(\d*)$/.exec(raw);
  if(!range||(!range[1]&&!range[2]))return new Response(null,{status:416,headers:{"Content-Range":`bytes */${file.size}`}});
  if(range[1]){start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}else start=Math.max(0,file.size-Number(range[2]));
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=file.size)return new Response(null,{status:416,headers:{"Content-Range":`bytes */${file.size}`}});
  status=206;headers.set("Content-Range",`bytes ${start}-${end}/${file.size}`);
 }
 headers.set("Content-Length",String(end-start+1));
 const node=fs.createReadStream(file.path,{start,end}),reader=(Readable.toWeb(node) as ReadableStream<Uint8Array>).getReader();
 let cancelled=false;
 const body=new ReadableStream<Uint8Array>({
  async pull(controller){try{
   const next=await reader.read();if(cancelled)return;
   if(!next.done){controller.enqueue(next.value);return;}
   if(start===0&&end===file.size-1){
    const current=await db.book.findUnique({where:{id:n},select:{koboSync:true,updatedAt:true}});
    if(current?.koboSync&&current.updatedAt.getTime()===book.updatedAt.getTime()){
     const now=new Date();await db.koboBookState.upsert({where:{bookId:n},create:{bookId:n,syncedAt:now,downloadedAt:now},update:{syncedAt:now,downloadedAt:now}});
     console.info(JSON.stringify({event:"kobo.download.complete",bookId:n,bytes:file.size}));
    }
   }
   if(!cancelled)controller.close();
  }catch(error){if(!cancelled)controller.error(error);}},
  async cancel(reason){cancelled=true;await reader.cancel(reason);}
 });
 return new Response(body,{status,headers});
}

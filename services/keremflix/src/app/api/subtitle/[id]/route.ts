import {prisma} from "@/lib/db";
import {externalSubtitles,readExternalSubtitle} from "@/lib/external-subtitles";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<1)return new Response("Geçersiz kimlik",{status:400});
 const ep=await prisma.episode.findUnique({where:{id:Number(id)},select:{filePath:true}});if(!ep)return new Response("Bulunamadı",{status:404});
 const file=new URL(req.url).searchParams.get("file");if(file!==null&&!/^[a-f0-9]{24}$/.test(file))return new Response("Geçersiz altyazı",{status:400});
 try{
  const subtitles=await externalSubtitles(ep.filePath),selected=file?subtitles.find(s=>s.id===file):subtitles[0];
  if(!selected)return new Response("Altyazı yok",{status:404});
  return new Response(await readExternalSubtitle(ep.filePath,selected),{headers:{"Content-Type":"text/vtt; charset=utf-8","Cache-Control":file?"private, max-age=300":"no-store"}});
 }catch{return new Response("Altyazı okunamadı",{status:404});}
}

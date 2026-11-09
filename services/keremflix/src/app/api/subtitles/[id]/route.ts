import {externalSubtitles} from "@/lib/external-subtitles";
import {prisma} from "@/lib/db";
import {subtitleStreams,extractSubtitle} from "@/lib/subtitles";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<1)return Response.json({error:"Geçersiz kimlik"},{status:400});
 const ep=await prisma.episode.findUnique({where:{id:Number(id)},select:{filePath:true}});if(!ep)return Response.json({error:"Bölüm yok"},{status:404});
 try{
 const raw=new URL(req.url).searchParams.get("stream");
 if(raw===null){
  const [embedded,external]=await Promise.allSettled([subtitleStreams(ep.filePath),externalSubtitles(ep.filePath)]);
  const streams=embedded.status==="fulfilled"?embedded.value:[],files=external.status==="fulfilled"?external.value:[];
  return Response.json({streams,external:files.map(({filePath,...item})=>item),error:embedded.status==="rejected"&&files.length===0});
 }
 const streams=await subtitleStreams(ep.filePath);
 if(!/^\d+$/.test(raw))return Response.json({error:"Geçersiz akış"},{status:400});
 const stream=streams.find(s=>s.index===Number(raw));if(!stream)return Response.json({error:"Altyazı yok"},{status:404});
 if(!stream.supported)return Response.json({error:"Görüntü tabanlı altyazı tarayıcıda desteklenmiyor"},{status:422});
 return new Response(await extractSubtitle(ep.filePath,stream.index),{headers:{"Content-Type":"text/vtt; charset=utf-8","Cache-Control":"private, max-age=300"}});
 }catch{return Response.json({error:"Altyazılar okunamadı"},{status:502});}
}

import {prisma} from "@/lib/db";
import {probeAudio,streamAudio,AudioBusyError} from "@/lib/audio";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<1)return Response.json({error:"Geçersiz kimlik"},{status:400});
 const ep=await prisma.episode.findUnique({where:{id:Number(id)},select:{filePath:true}});if(!ep)return Response.json({error:"Bölüm yok"},{status:404});
 const query=new URL(req.url).searchParams,raw=query.get("stream"),startRaw=query.get("start")??"0",start=Number(startRaw);
 if(raw!==null&&(!/^\d+$/.test(raw)||!startRaw.trim()||!Number.isFinite(start)||start<0))return Response.json({error:"Geçersiz ses seçimi"},{status:400});
 try{
  const data=await probeAudio(ep.filePath);const defaultIndex=(data.streams.find(s=>s.isDefault)??data.streams[0])?.index??null;
  if(raw===null)return Response.json({...data,defaultIndex});
  const selected=data.streams.find(s=>s.index===Number(raw));if(!selected)return Response.json({error:"Ses akışı yok"},{status:404});
  if(data.duration>0&&start>=data.duration)return Response.json({error:"Geçersiz zaman"},{status:400});
  return new Response(await streamAudio(ep.filePath,selected.index,start,req.signal),{headers:{"Content-Type":"audio/mpeg","Cache-Control":"no-store","X-Accel-Buffering":"no","Accept-Ranges":"none"}});
 }catch(error){return Response.json({error:error instanceof AudioBusyError?"Ses hazırlanıyor, biraz sonra yeniden deneyin":"Ses akışı hazırlanamadı"},{status:error instanceof AudioBusyError?503:502});}
}

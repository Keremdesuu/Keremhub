import { prisma } from "@/lib/db";
import { searchMovies, tmdbMovieById } from "@/lib/metadata/tmdb";
import { config } from "@/lib/config";
import { z } from "zod";
export const dynamic="force-dynamic";
async function movie(id:string){return /^\d+$/.test(id)&&Number.isSafeInteger(Number(id))?prisma.title.findUnique({where:{id:Number(id)}}):null;}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const t=await movie((await params).id);if(!t||t.kind!=="MOVIE")return Response.json({error:"Film bulunamadı"},{status:404});
 const q=new URL(req.url).searchParams.get("q")?.trim();if(!q||q.length>200)return Response.json({error:"Film adı girin"},{status:400});
 if(!config.tmdbKey)return Response.json({error:"TMDB anahtarı ayarlanmamış"},{status:503});
 try{return Response.json({results:await searchMovies(q)});}catch{return Response.json({error:"Metadata kaynağına ulaşılamadı"},{status:502});}
}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const t=await movie((await params).id);if(!t||t.kind!=="MOVIE")return Response.json({error:"Film bulunamadı"},{status:404});
 const b=z.object({tmdbId:z.number().int().positive()}).safeParse(await req.json().catch(()=>null));if(!b.success)return Response.json({error:"Geçersiz seçim"},{status:400});
 try{
 const m=await tmdbMovieById(b.data.tmdbId);if(!m)return Response.json({error:"Film bulunamadı"},{status:404});
 await prisma.title.update({where:{id:t.id},data:{title:m.title,originalTitle:m.originalTitle??null,year:m.year??null,overview:m.overview??null,posterUrl:m.posterUrl??null,backdropUrl:m.backdropUrl??null,genres:JSON.stringify(m.genres),cast:JSON.stringify(m.cast),moods:JSON.stringify(m.moods),rating:m.rating??null,certification:m.certification??null,runtime:m.runtime??null,tmdbId:m.tmdbId,anilistId:null,metaStatus:"manual"}});
 return Response.json({ok:true});
 }catch{return Response.json({error:"Film bilgileri güncellenemedi"},{status:502});}
}

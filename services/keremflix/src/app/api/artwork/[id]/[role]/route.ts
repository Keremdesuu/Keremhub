import {prisma} from "@/lib/db";
import {renderArtwork,type ArtworkRole} from "@/lib/artwork";
export const dynamic="force-dynamic";
export async function GET(_req:Request,{params}:{params:Promise<{id:string;role:string}>}){
 const {id,role}=await params,n=Number(id);
 if(!/^\d+$/.test(id)||!Number.isSafeInteger(n)||n<1||!["poster","card","hero"].includes(role))return new Response(null,{status:400});
 const title=await prisma.title.findUnique({where:{id:n},select:{posterUrl:true,backdropUrl:true,kind:true}});if(!title)return new Response(null,{status:404});
 try{return new Response(new Uint8Array(await renderArtwork(title,role as ArtworkRole)),{headers:{"Content-Type":"image/webp","Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff"}});}
 catch{await prisma.title.update({where:{id:n},data:{metaStatus:"artwork-unavailable"}}).catch(()=>{});return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});}
}

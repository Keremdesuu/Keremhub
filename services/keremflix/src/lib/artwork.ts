import fs from "node:fs/promises";
import path from "node:path";
import {createHash,randomUUID} from "node:crypto";
import sharp from "sharp";
sharp.concurrency(1);
export type ArtworkRole="poster"|"card"|"hero";
type Sources={posterUrl:string|null;backdropUrl:string|null;kind?:string};
const sizes={poster:[400,600],card:[640,360],hero:[1600,900]} as const;
const cache=process.env.KEREMFLIX_ART_CACHE||path.join(process.cwd(),"data","artwork");
const pending=new Map<string,Promise<Buffer>>();
let active=0;const queue:(()=>void)[]=[];
async function acquire(){if(active<2){active++;return;}await new Promise<void>(resolve=>queue.push(resolve));}
function release(){const next=queue.shift();if(next)next();else active--;}
async function atomic(file:string,data:Buffer){const tmp=file+"."+randomUUID();try{await fs.writeFile(tmp,data);await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}}
function allowed(value:string){const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&["image.tmdb.org","static.tvmaze.com","s4.anilist.co","s.anilist.co"].includes(u.hostname);}
async function source(url:string):Promise<Buffer>{
 if(!allowed(url))throw new Error("Unsupported artwork source");
 const file=path.join(cache,createHash("sha256").update(url).digest("hex")+".source");
 try{return await fs.readFile(file);}catch{}
 const r=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:"error"});
 if(!r.ok||!r.headers.get("content-type")?.startsWith("image/"))throw new Error("Artwork unavailable");
 if(Number(r.headers.get("content-length"))>16*1024*1024)throw new Error("Artwork too large");
 const reader=r.body?.getReader();if(!reader)throw new Error("Missing artwork body");
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16*1024*1024)throw new Error("Artwork too large");chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
 const data=Buffer.concat(chunks);await sharp(data,{limitInputPixels:40000000}).metadata();await atomic(file,data);return data;
}
export async function renderArtwork(s:Sources,role:ArtworkRole):Promise<Buffer>{
 const version=s.kind==="ANIME"&&role!=="poster"?"v3-anime":"v2";
 const key=createHash("sha256").update(JSON.stringify([version,{posterUrl:s.posterUrl,backdropUrl:s.backdropUrl},role])).digest("hex"),file=path.join(cache,key+".webp");
 try{return await fs.readFile(file);}catch{}
 const existing=pending.get(key);if(existing)return existing;
 const job=(async()=>{await acquire();try{
  await fs.mkdir(cache,{recursive:true});const [width,height]=sizes[role];
  let data:Buffer|null=null;
  if(role!=="poster"&&s.backdropUrl){try{const raw=await source(s.backdropUrl),m=await sharp(raw).metadata();if((m.width||0)/(m.height||1)>=1.3)data=raw;}catch{}}
  if(role==="poster"&&s.posterUrl){try{data=await source(s.posterUrl);}catch{}}
  let output:Buffer;
  if(data){
   if(role==="poster")output=await sharp(data).rotate().resize(width,height,{fit:"contain",background:"#141414"}).webp({quality:82}).toBuffer();
   else if(s.kind==="ANIME")output=await sharp(data).rotate().resize(width,height,{fit:"cover",position:"centre"}).webp({quality:role==="hero"?86:84}).toBuffer();
   else {
    const background=await sharp(data).rotate().resize(width,height,{fit:"cover"}).blur(24).modulate({brightness:.4}).toBuffer();
    const foreground=await sharp(data).rotate().resize(width,height,{fit:"inside"}).png().toBuffer();
    output=await sharp(background).composite([{input:foreground,gravity:"centre"}]).webp({quality:role==="hero"?86:84}).toBuffer();
   }
  }
  else {
   let raw:Buffer|null=null;for(const fallback of [s.posterUrl,s.backdropUrl]){if(fallback){try{raw=await source(fallback);break;}catch{}}}
   if(!raw)throw new Error("No artwork available");
   const background=await sharp(raw).resize(width,height,{fit:"cover",position:"centre"}).blur(24).modulate({brightness:.35}).toBuffer();
   const foreground=await sharp(raw).resize(Math.round(width*.82),Math.round(height*.94),{fit:"inside"}).png().toBuffer();
   output=await sharp(background).composite([{input:foreground,gravity:"centre"}]).webp({quality:82}).toBuffer();
  }
  await atomic(file,output);return output;
 }finally{release();}})();pending.set(key,job);try{return await job;}finally{pending.delete(key);}
}

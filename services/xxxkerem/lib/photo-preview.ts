import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from './prisma';
import { resolveMediaFile } from './config';
export const PREVIEW_DIR=path.resolve('./data/previews');
const pending=new Map<string,Promise<Buffer>>();
export async function photoPreview(id:number){
 const m=await prisma.media.findUnique({where:{id}});
 if(!m||m.kind!=='IMAGE')throw new Error('Not found');
 const file=resolveMediaFile(m.avatarFile??m.path);if(!file)throw new Error('Invalid path');
 const stat=await fs.stat(file),key=`${id}-${Math.trunc(stat.mtimeMs)}-${stat.size}`;
 const cached=path.join(PREVIEW_DIR,key+'.webp');
 try{return {data:await fs.readFile(cached),key};}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 let work=pending.get(key);
 if(!work){
  work=(async()=>{
   // Animated images retain their original playback in the viewer.
   const pipeline=sharp(file,{limitInputPixels:80000000});const meta=await pipeline.metadata();
   if((meta.pages??1)>1)throw new Error('Animated image');
   const data=await pipeline.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:3}).toBuffer();
   await fs.mkdir(PREVIEW_DIR,{recursive:true});
   const temp=cached+'.tmp';await fs.writeFile(temp,data);await fs.rename(temp,cached);return data;
  })();
  pending.set(key,work);
 }
 try{return {data:await work,key};}finally{pending.delete(key);}
}
export async function removePhotoPreviews(id:number){
 await Promise.allSettled([...pending.entries()].filter(([key])=>key.startsWith(`${id}-`)).map(([,work])=>work));
 const names=await fs.readdir(PREVIEW_DIR).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
 for(const name of names)if(name.startsWith(`${id}-`))await fs.rm(path.join(PREVIEW_DIR,name),{force:true});
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from './prisma';
import { MEDIA_DIR, UPLOAD_DIR, PROFILE_DIR, THUMB_DIR, UPLOAD_PREFIX, PROFILE_PREFIX, resolveMediaFile } from './config';
import { requireLibraryMount } from './scan-safety';
const busy = new Set<number>();
export async function rotateMedia(id: number) {
 if (busy.has(id)) throw new Error('Bu fotoğraf işleniyor; lütfen bekleyin.');
 busy.add(id);
 let temporary: string | undefined, temporaryThumb: string | undefined;
 try {
  const media=await prisma.media.findUnique({where:{id}});
  if(!media || media.kind!=='IMAGE' || media.isAvatar) throw new Error('Fotoğraf bulunamadı.');
  const root=media.path.startsWith(UPLOAD_PREFIX)?UPLOAD_DIR:media.path.startsWith(PROFILE_PREFIX)?PROFILE_DIR:MEDIA_DIR;
  requireLibraryMount(root);
  const file=resolveMediaFile(media.path);if(!file)throw new Error('Geçersiz dosya yolu.');
  const realRoot=await fs.realpath(root),parent=await fs.realpath(path.dirname(file));
  if(parent!==realRoot&&!parent.startsWith(realRoot+path.sep))throw new Error('Geçersiz dosya yolu.');
  const stat=await fs.lstat(file);if(!stat.isFile())throw new Error('Geçersiz dosya türü.');
  const original=await fs.readFile(file);
  const metadata=await sharp(original,{limitInputPixels:80000000}).metadata();
  if((metadata.pages??1)>1)throw new Error('Hareketli görsellerde kalıcı döndürme desteklenmiyor.');
  let pipeline=sharp(original,{limitInputPixels:80000000}).autoOrient().rotate(90).withMetadata({orientation:1});
  if(metadata.format==='jpeg')pipeline=pipeline.jpeg({quality:98});
  if(metadata.format==='webp')pipeline=pipeline.webp({lossless:true});
  const {data,info}=await pipeline.toBuffer({resolveWithObject:true});
  const thumb=await sharp(data).resize({width:480,height:480,fit:'cover'}).jpeg({quality:78}).toBuffer();
  await fs.mkdir(THUMB_DIR,{recursive:true});
  const thumbPath=path.join(THUMB_DIR,`${id}.jpg`);
  const oldThumb=await fs.readFile(thumbPath).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  temporary=path.join(path.dirname(file),`.rotate-${randomUUID()}.tmp`);
  temporaryThumb=path.join(THUMB_DIR,`.rotate-${randomUUID()}.tmp`);
  await fs.writeFile(temporary,data,{flag:'wx',mode:stat.mode&0o777});
  await fs.writeFile(temporaryThumb,thumb,{flag:'wx'});
  await fs.chmod(temporary,stat.mode&0o777);
  const latest=await fs.stat(file);
  if(latest.mtimeMs!==stat.mtimeMs||latest.size!==stat.size)throw new Error('Dosya değişti; tekrar deneyin.');
  let replaced=false,thumbReplaced=false;
  try {
   await fs.rename(temporary,file);replaced=true;
   await fs.rename(temporaryThumb,thumbPath);thumbReplaced=true;
   const updated=await prisma.media.update({where:{id},data:{width:info.width,height:info.height,mtime:new Date()}});
   return {ok:true,width:info.width,height:info.height,version:updated.mtime.getTime()};
  }catch(e){
   if(replaced){await fs.writeFile(temporary,original,{mode:stat.mode&0o777});await fs.rename(temporary,file);await fs.utimes(file,stat.atime,stat.mtime);}
   if(thumbReplaced){if(oldThumb){await fs.writeFile(temporaryThumb,oldThumb);await fs.rename(temporaryThumb,thumbPath);}else await fs.rm(thumbPath,{force:true});}
   throw e;
  }
 }finally{
  if(temporary)await fs.rm(temporary,{force:true});
  if(temporaryThumb)await fs.rm(temporaryThumb,{force:true});
  busy.delete(id);
 }
}

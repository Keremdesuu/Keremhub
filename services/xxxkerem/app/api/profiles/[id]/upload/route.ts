import { prepareAvatar } from '@/lib/avatar';
import { requireLibraryMount } from '@/lib/scan-safety';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { IMAGE_EXT, VIDEO_EXT, MEDIA_DIR, PHOTO_DIR, VIDEO_DIR, PROFILE_DIR, PROFILE_PREFIX, THUMB_DIR } from '@/lib/config';
import { imageSize, makeImageThumb, titleFromFile, probeVideo, makeVideoThumb } from '@/lib/scan';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const id=Number((await params).id);
 if(!Number.isSafeInteger(id)||id<1)return new Response('Geçersiz kimlik',{status:400});
 if(!await prisma.profile.findUnique({where:{id}}))return Response.json({error:'Profil bulunamadı'},{status:404});
 const form=await req.formData().catch(()=>null),avatar=form?.get('avatar')==='true';
 const files=(form?.getAll('files')??[]).filter((f):f is File=>f instanceof File);
 if(!files.length)return Response.json({error:'Dosya seçilmedi'},{status:400});
 let added=0,skipped=0,images=0,videos=0;
 for(const f of files){
  const ext=path.extname(f.name).toLowerCase(),video=VIDEO_EXT.has(ext);
  if((!IMAGE_EXT.has(ext)&&!video)||(avatar&&video)||!f.size||f.size>(video?190:40)*1024*1024){skipped++;continue;}
  const root=avatar?PROFILE_DIR:video?VIDEO_DIR:PHOTO_DIR;
  const name=randomUUID()+ext,abs=path.join(root,name),relative=path.relative(MEDIA_DIR,abs);
  if(!avatar&&(relative.startsWith('..')||path.isAbsolute(relative))){skipped++;continue;}
  let createdId:number|null=null;
  try{
   requireLibraryMount(root);
   await fs.mkdir(root,{recursive:true});await fs.mkdir(THUMB_DIR,{recursive:true});
   await fs.writeFile(abs,Buffer.from(await f.arrayBuffer()),{flag:'wx'});
   const meta=video?await probeVideo(abs):{duration:null,...await imageSize(abs)};
   if(!meta.width||!meta.height)throw new Error('Geçersiz medya');
   const row=await prisma.media.create({data:{kind:video?'VIDEO':'IMAGE',path:avatar?PROFILE_PREFIX+name:relative,title:titleFromFile(f.name),width:meta.width,height:meta.height,duration:meta.duration,mtime:new Date(),isAvatar:avatar,profiles:{connect:{id}}}});
   createdId=row.id;
   if(video)await makeVideoThumb(row.id,abs,meta.duration);else await makeImageThumb(row.id,abs);
   if(avatar){await prepareAvatar(row.id);await prisma.profile.update({where:{id},data:{avatarMediaId:row.id}});}
   added++;if(video)videos++;else images++;
  }catch{
   if(createdId!==null){await prisma.media.delete({where:{id:createdId}});await fs.rm(path.join(THUMB_DIR,`${createdId}.jpg`),{force:true});}
   await fs.rm(abs,{force:true}).catch(()=>{});skipped++;
  }
 }
 return Response.json({added,skipped,images,videos});
}

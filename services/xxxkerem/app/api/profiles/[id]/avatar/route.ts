import { requireLibraryMount } from "@/lib/scan-safety";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { PROFILE_DIR, PROFILE_PREFIX, THUMB_DIR, resolveMediaFile } from "@/lib/config";
import { makeImageThumb } from "@/lib/scan";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
 const id = Number((await params).id);
 if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Geçersiz profil" }, { status: 400 });
 if (!await prisma.profile.findUnique({ where: { id } })) return Response.json({ error: "Profil bulunamadı" }, { status: 404 });
 const form = await req.formData().catch(() => null);
 if (!form) return Response.json({ error: "Geçersiz dosya" }, { status: 400 });
 const crop = ['x','y','size'].map(k => Number(form.get(k)));
 const [x,y,size] = crop;
 if (!crop.every(Number.isFinite) || x < 0 || y < 0 || size <= 0 || x > 1 || y > 1 || size > 1) return Response.json({ error: "Geçersiz kırpma alanı" }, { status: 400 });
 const file = form.get('file');
 const mediaId = Number(form.get('mediaId'));
 let source: Buffer;
 let sourceMedia: number | undefined;
 try {
  if (file instanceof File) {
   if (!file.size || file.size > 40*1024*1024) throw new Error();
   source = Buffer.from(await file.arrayBuffer());
  } else {
   if (!Number.isSafeInteger(mediaId) || mediaId < 1) throw new Error();
   const m = await prisma.media.findUnique({ where: { id: mediaId } });
   if (!m || m.kind !== 'IMAGE') throw new Error();
   const abs = resolveMediaFile(m.path); if (!abs) throw new Error();
   source = await fs.readFile(abs); sourceMedia = m.id;
  }
  // Decode and apply EXIF orientation before interpreting preview coordinates.
  const { data, info } = await sharp(source, { limitInputPixels: 80000000 }).rotate().png().toBuffer({ resolveWithObject: true });
  const side = Math.min(info.width, info.height, Math.max(1, Math.round(size * Math.min(info.width, info.height))));
  // Coordinates are fractions of width/height; size is a fraction of the shorter edge.
  const left = Math.round(x * info.width), top = Math.round(y * info.height);
  if (left + side > info.width + 1 || top + side > info.height + 1) throw new Error();
  const cropped = await sharp(data).extract({ left: Math.min(left,info.width-side), top: Math.min(top,info.height-side), width: side, height: side }).resize(768,768).jpeg({ quality: 92 }).toBuffer();
  requireLibraryMount(PROFILE_DIR);
  await fs.mkdir(PROFILE_DIR,{recursive:true}); await fs.mkdir(THUMB_DIR,{recursive:true});
  const key = randomUUID(), original = key+'-original.png', avatar = key+'.jpg';
  let createdId: number | undefined;
  try {
   await fs.writeFile(path.join(PROFILE_DIR,original),data,{flag:'wx'});
   await fs.writeFile(path.join(PROFILE_DIR,avatar),cropped,{flag:'wx'});
   const row = await prisma.media.create({ data: { kind:'IMAGE', path:PROFILE_PREFIX+original, avatarFile:PROFILE_PREFIX+avatar, isAvatar:true, title:'Profil fotoğrafı', width:768, height:768, mtime:new Date(), profiles:{connect:{id}} } });
   createdId = row.id; await makeImageThumb(row.id,path.join(PROFILE_DIR,avatar));
   await prisma.$transaction(async tx => {
    await tx.profile.update({where:{id},data:{avatarMediaId:row.id}});
    if(sourceMedia) await tx.media.update({where:{id:sourceMedia},data:{isAvatar:true}});
   });
   return Response.json({ok:true,mediaId:row.id});
  } catch(e) {
   if(createdId) { await prisma.media.delete({where:{id:createdId}}); await fs.rm(path.join(THUMB_DIR,`${createdId}.jpg`),{force:true}); }
   await fs.rm(path.join(PROFILE_DIR,original),{force:true});await fs.rm(path.join(PROFILE_DIR,avatar),{force:true});throw e;
  }
 } catch { return Response.json({error:'Fotoğraf işlenemedi. Geçerli bir görsel ve kırpma alanı seçin.'},{status:400}); }
}

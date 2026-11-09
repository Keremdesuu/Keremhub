import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from '../lib/prisma';
import { PHOTO_DIR,VIDEO_DIR,PROFILE_DIR,resolveMediaFile } from '../lib/config';
import { scanLibrary } from '../lib/scan';
import { listMedia } from '../lib/queries';
import { deleteMedia } from '../lib/delete-media';
async function main(){
 for(const dir of [PHOTO_DIR,VIDEO_DIR,PROFILE_DIR])assert(dir.startsWith('/mnt/hdd/xxxkerem/'));
 const p=await prisma.profile.create({data:{name:`__hdd_test_${Date.now()}`,hidden:true}});
 const base='http://127.0.0.1:3300/xxxkerem',videoFile=path.resolve(`data/test-upload-${p.id}.mp4`);
 try{
  await promisify(execFile)('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','color=c=red:s=32x32:d=1','-c:v','libx264','-pix_fmt','yuv420p',videoFile]);
  const image=await sharp({create:{width:32,height:32,channels:3,background:'#123456'}}).png().toBuffer();
  for(const [name,buffer] of [['test.png',image],['test.mp4',await fs.readFile(videoFile)]] as const){
   const fd=new FormData();fd.append('files',new Blob([new Uint8Array(buffer)]),name);
   const r=process.env.DIRECT==='1' ? await (await import('../app/api/profiles/[id]/upload/route')).POST(new Request('http://localhost/upload',{method:'POST',body:fd}),{params:Promise.resolve({id:String(p.id)})}) : await fetch(`${base}/api/profiles/${p.id}/upload`,{method:'POST',body:fd});const j=await r.json();console.log(name,j);assert.equal(r.status,200);assert.equal(j.added,1);
  }
  const fd=new FormData();fd.append('file',new Blob([new Uint8Array(image)]),'avatar.png');for(const [k,v] of [['x','0'],['y','0'],['size','1']])fd.append(k,v);
  const r=await fetch(`${base}/api/profiles/${p.id}/avatar`,{method:'POST',body:fd});assert.equal(r.status,200);
  const rows=await prisma.media.findMany({where:{profiles:{some:{id:p.id}}}});assert.equal(rows.length,3);
  for(const row of rows){
   const abs=resolveMediaFile(row.path)!;assert(abs.startsWith(row.isAvatar?PROFILE_DIR:row.kind==='VIDEO'?VIDEO_DIR:PHOTO_DIR));await fs.access(abs);
   if(row.avatarFile)assert(resolveMediaFile(row.avatarFile)!.startsWith(PROFILE_DIR));
  }
  for(const kind of ['IMAGE','VIDEO'] as const){
   const global=await listMedia({kind,sort:'new',page:1,pageSize:1000});assert(!global.items.some(m=>rows.some(r=>r.id===m.id)));
   assert.equal((await listMedia({kind,sort:'new',page:1,profileId:p.id})).total,1);
  }
  // Confirm all known files exist before testing a full scan.
  const all=await prisma.media.findMany();for(const row of all){const file=resolveMediaFile(row.path);assert(file);await fs.access(file);}
  const before=await prisma.media.count(),relations=await prisma.profile.findMany({select:{id:true,hidden:true,media:{select:{id:true}}},orderBy:{id:'asc'}});
  const scan=await scanLibrary();assert.equal(scan.added,0);assert.equal(scan.removed,0);assert.equal(scan.errors,0);assert.equal(await prisma.media.count(),before);
  assert.deepEqual(await prisma.profile.findMany({select:{id:true,hidden:true,media:{select:{id:true}}},orderBy:{id:'asc'}}),relations);
  console.log('PASS: new photos/videos and avatars stored on HDD, hidden contents excluded globally, profile access intact, scanner excludes Profil and creates no duplicates');
 }finally{
  const rows=await prisma.media.findMany({where:{profiles:{some:{id:p.id}}}});for(const row of rows)await deleteMedia(row.id);
  await prisma.profile.delete({where:{id:p.id}});await fs.rm(videoFile,{force:true});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

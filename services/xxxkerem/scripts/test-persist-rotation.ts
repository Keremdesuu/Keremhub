import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { MEDIA_DIR, THUMB_DIR } from '../lib/config';
import { requireLibraryMount } from '../lib/scan-safety';
import { POST } from '../app/api/media/[id]/rotate/route';
async function main(){
 requireLibraryMount(MEDIA_DIR);
 const name=`__rotation_test_${Date.now()}.png`,file=path.join(MEDIA_DIR,name);
 const original=await sharp({create:{width:800,height:400,channels:3,background:'#0000ff'}}).composite([{input:await sharp({create:{width:400,height:400,channels:3,background:'#ff0000'}}).png().toBuffer(),left:0,top:0}]).png().toBuffer();
 await fs.writeFile(file,original,{flag:'wx'});
 const m=await prisma.media.create({data:{path:name,title:name,kind:'IMAGE',mtime:new Date(),width:800,height:400}});
 const thumb=path.join(THUMB_DIR,`${m.id}.jpg`);
 async function rotate(){
  if(process.env.TEST_LIVE==='1')return fetch(`http://127.0.0.1:3300/xxxkerem/api/media/${m.id}/rotate`,{method:'POST'});
  return POST(new Request('http://localhost/rotate',{method:'POST'}),{params:Promise.resolve({id:String(m.id)})});
 }
 try{
  for(let i=1;i<=4;i++){
   const r=await rotate();assert.equal(r.status,200);const result=await r.json();
   const expected=i%2?[400,800]:[800,400];
   const disk=await sharp(file).metadata();assert.deepEqual([disk.width,disk.height],expected);assert.equal(disk.orientation,1);
   const row=await prisma.media.findUniqueOrThrow({where:{id:m.id}});assert.deepEqual([row.width,row.height],expected);assert.equal(row.mtime.getTime(),result.version);
   assert((await fs.stat(thumb)).size>0);
   if(i===1){const px=await sharp(file).extract({left:200,top:100,width:1,height:1}).raw().toBuffer();assert(px[0]>240&&px[2]<15);}
   if(process.env.TEST_LIVE==='1'){
    const served=await fetch(`http://127.0.0.1:3300/xxxkerem/api/file/${m.id}?v=${result.version}`);const meta=await sharp(Buffer.from(await served.arrayBuffer())).metadata();assert.deepEqual([meta.width,meta.height],expected);
   }
  }
  const a=await sharp(original).raw().toBuffer(),b=await sharp(file).raw().toBuffer();assert(a.equals(b));
  // A failed database write must restore the source and thumbnail.
  if(process.env.TEST_LIVE!=='1'){
   const old=await fs.readFile(file),oldThumb=await fs.readFile(thumb),update=prisma.media.update;
   try{(prisma.media as any).update=async()=>{throw new Error('Test write failure')};assert.equal((await rotate()).status,400);}
   finally{prisma.media.update=update;}
   assert(old.equals(await fs.readFile(file)));assert(oldThumb.equals(await fs.readFile(thumb)));
  }
  console.log('PASS: original HDD bytes rotate, four turns, dimensions, EXIF orientation, thumbnail, fresh file serving, failure rollback');
 }finally{await prisma.media.delete({where:{id:m.id}});await fs.unlink(file);await fs.rm(thumb,{force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

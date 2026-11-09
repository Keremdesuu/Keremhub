import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { UPLOAD_DIR,UPLOAD_PREFIX } from '../lib/config';
import { photoPreview, PREVIEW_DIR } from '../lib/photo-preview';
import { rotateMedia } from '../lib/rotate-media';
import { deleteMedia } from '../lib/delete-media';
async function main(){
 const name=`__preview_test_${Date.now()}.png`,file=path.join(UPLOAD_DIR,name);
 await fs.mkdir(UPLOAD_DIR,{recursive:true});
 const original=await sharp({create:{width:2400,height:1800,channels:3,background:'#a144dd'}}).png().toBuffer();await fs.writeFile(file,original,{flag:'wx'});
 const m=await prisma.media.create({data:{kind:'IMAGE',path:UPLOAD_PREFIX+name,title:name,mtime:new Date()}});
 try{
  const results=await Promise.all([photoPreview(m.id),photoPreview(m.id)]);assert(results[0].data.equals(results[1].data));
  const meta=await sharp(results[0].data).metadata();assert.equal(meta.width,1600);assert.equal(meta.height,1200);
  assert(original.equals(await fs.readFile(file)));
  await rotateMedia(m.id);const rotated=await photoPreview(m.id);assert.notEqual(rotated.key,results[0].key);
  const meta2=await sharp(rotated.data).metadata();assert.equal(meta2.width,1200);assert.equal(meta2.height,1600);
  if(process.env.TEST_LIVE==='1'){
   const url=`http://127.0.0.1:3300/xxxkerem/api/preview/${m.id}?v=2`;
   const r=await fetch(url);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');
   assert.equal((await fetch(url,{headers:{'if-none-match':r.headers.get('etag')!}})).status,304);
   const html=await (await fetch(`http://127.0.0.1:3300/xxxkerem/photo/${m.id}`)).text();assert(html.includes(`/api/preview/${m.id}`));
  }
 }finally{
  await deleteMedia(m.id);assert(!(await fs.readdir(PREVIEW_DIR)).some(n=>n.startsWith(`${m.id}-`)));
 }
 console.log('PASS: bounded previews, concurrent cache generation, original preservation, rotation freshness, preview cleanup, HTTP caching');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

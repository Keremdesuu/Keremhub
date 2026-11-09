import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { resolveMediaFile } from '../lib/config';
import { deleteMedia } from '../lib/delete-media';
import { POST } from '../app/api/profiles/[id]/avatar/route';
import { listMedia } from '../lib/queries';
async function main(){
 const p=await prisma.profile.create({data:{name:`__crop_test_${Date.now()}`}});
 try{
  const red=await sharp({create:{width:400,height:400,channels:3,background:'#ff0000'}}).png().toBuffer();
  const image=await sharp({create:{width:800,height:400,channels:3,background:'#0000ff'}}).composite([{input:red,left:0,top:0}]).png().toBuffer();
  async function crop(x:number,y:number,size:number,mediaId?:number){
   const fd=new FormData();fd.append('x',String(x));fd.append('y',String(y));fd.append('size',String(size));
   if(mediaId)fd.append('mediaId',String(mediaId));else fd.append('file',new Blob([new Uint8Array(image)],{type:'image/png'}),'test.png');
   if(process.env.TEST_LIVE==='1')return fetch(`http://127.0.0.1:3300/xxxkerem/api/profiles/${p.id}/avatar`,{method:'POST',body:fd});
   return POST(new Request('http://localhost/avatar',{method:'POST',body:fd}),{params:Promise.resolve({id:String(p.id)})});
  }
  const right=await crop(.5,0,1);assert.equal(right.status,200);const first=(await right.json()).mediaId;
  async function check(id:number,color:'red'|'blue'){
   const m=await prisma.media.findUniqueOrThrow({where:{id}});assert(m.isAvatar);assert(m.avatarFile?.startsWith('@profil/'));
   const file=resolveMediaFile(m.avatarFile!)!;const meta=await sharp(file).metadata();assert.equal(meta.width,768);assert.equal(meta.height,768);
   const pixel=await sharp(file).extract({left:380,top:380,width:1,height:1}).raw().toBuffer();
   assert(color==='red'?pixel[0]>240&&pixel[2]<15:pixel[2]>240&&pixel[0]<15);
   const source=await sharp(resolveMediaFile(m.path)!).metadata();assert.equal(source.width,800);assert.equal(source.height,400);
  }
  await check(first,'blue');
  const left=await crop(0,0,1,first);assert.equal(left.status,200);await check((await left.json()).mediaId,'red');
  const zoom=await crop(.6,.25,.5,first);assert.equal(zoom.status,200);const last=(await zoom.json()).mediaId;await check(last,'blue');
  assert.equal((await crop(.9,0,1,first)).status,400);assert.equal((await crop(0,0,0)).status,400);
  assert.equal((await prisma.profile.findUniqueOrThrow({where:{id:p.id}})).avatarMediaId,last);
  assert.equal((await listMedia({kind:'IMAGE',sort:'new',page:1,profileId:p.id})).total,0);
  console.log('PASS: selected landscape region, zoom crop, repeat edit from full original, invalid crop preserves avatar, profile-only storage');
 }finally{
  const rows=await prisma.media.findMany({where:{profiles:{some:{id:p.id}}}});
  for(const row of rows)await deleteMedia(row.id);
  await prisma.profile.delete({where:{id:p.id}});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

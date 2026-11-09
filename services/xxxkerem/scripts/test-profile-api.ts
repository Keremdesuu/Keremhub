import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { resolveMediaFile, THUMB_DIR } from '../lib/config';
const base='http://127.0.0.1:3300/xxxkerem';
async function main(){
 const p=await prisma.profile.create({data:{name:`__api_test_${Date.now()}`}});
 const mediaIds:number[]=[];
 try{
  const image=await sharp({create:{width:32,height:32,channels:3,background:'#123456'}}).png().toBuffer();
  for(const avatar of [false,true]){
   const fd=new FormData();fd.append('files',new Blob([new Uint8Array(image)],{type:'image/png'}),'test.png');
   if(avatar)fd.append('avatar','true');
   const r=await fetch(`${base}/api/profiles/${p.id}/upload`,{method:'POST',body:fd});
   assert.equal(r.status,200);assert.equal((await r.json()).added,1);
  }
  const rows=await prisma.media.findMany({where:{profiles:{some:{id:p.id}}},orderBy:{id:'asc'}});
  mediaIds.push(...rows.map(m=>m.id));assert.equal(rows.length,2);
  assert(!rows[0].isAvatar);assert(rows[1].isAvatar);
  assert(rows[1].avatarFile?.startsWith('@profil/'));
  assert.equal((await fetch(`${base}/api/file/${rows[1].id}`)).status,200);
  assert.equal((await fetch(`${base}/api/thumb/${rows[1].id}`)).status,200);
  const patch=await fetch(`${base}/api/profiles/${p.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({hidden:true})});
  assert.equal(patch.status,200);assert((await patch.json()).hidden);
  const home=await (await fetch(`${base}/api/mobile/media?kind=IMAGE`)).json();
  assert(!home.items.some((m:any)=>mediaIds.includes(m.id)));
  const detail=await (await fetch(`${base}/api/mobile/profile/${p.id}`)).json();
  assert.equal(detail.photos.total,1);assert.equal(detail.photos.items[0].id,rows[0].id);
  const page=await fetch(`${base}/profiles/${p.id}?tab=photos`);assert.equal(page.status,200);assert((await page.text()).includes('Gizli profil:'));
  assert.equal((await fetch(`${base}/photo/${rows[1].id}`)).status,404);
  const r=await fetch(`${base}/api/profiles/${p.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({hidden:false,avatarMediaId:rows[0].id})});
  assert.equal(r.status,200);assert((await prisma.media.findUniqueOrThrow({where:{id:rows[0].id}})).isAvatar);
  console.log('PASS: live upload, avatar storage/serving, hidden toggle, mobile/profile lists, avatar exclusion, select existing photo');
 }finally{
  const rows=await prisma.media.findMany({where:{profiles:{some:{id:p.id}}}});
  await prisma.profile.delete({where:{id:p.id}});
  for(const row of rows){
   await prisma.media.delete({where:{id:row.id}});
   for(const rel of [row.path,row.avatarFile])if(rel){const file=resolveMediaFile(rel);if(file)await fs.rm(file,{force:true});}
   await fs.rm(`${THUMB_DIR}/${row.id}.jpg`,{force:true});
  }
 }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

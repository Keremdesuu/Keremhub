import 'dotenv/config';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { photoNeighbors, recommendedVideos } from '../lib/queries';
const token=`__navigation_test_${Date.now()}`;
async function main(){
 const a=await prisma.profile.create({data:{name:token+'A',hidden:true}}),b=await prisma.profile.create({data:{name:token+'B'}});
 const ids:number[]=[];
 const make=async(kind:string,pid:number,isAvatar=false)=>{const m=await prisma.media.create({data:{kind,path:token+ids.length,title:token,mtime:new Date(),isAvatar,profiles:{connect:{id:pid}}}});ids.push(m.id);return m;};
 try{
  const b0=await make('IMAGE',b.id),a0=await make('IMAGE',a.id),b1=await make('IMAGE',b.id),a1=await make('IMAGE',a.id),av=await make('IMAGE',a.id,true),a2=await make('IMAGE',a.id),b2=await make('IMAGE',b.id);
  const middle=await photoNeighbors(a1.id,a.id);assert.equal(middle.newer?.id,a2.id);assert.equal(middle.older?.id,a0.id);
  assert.equal((await photoNeighbors(a2.id,a.id)).newer,null);
  assert.equal((await photoNeighbors(a0.id,a.id)).older,null);
  const general=await photoNeighbors(b1.id);assert.equal(general.older?.id,b0.id);assert.equal(general.newer?.id,b2.id);
  const va=await make('VIDEO',a.id),vb=await make('VIDEO',b.id),va2=await make('VIDEO',a.id);
  const rec=await recommendedVideos(va.id,[a.id],a.id);assert.deepEqual(rec.map(x=>x.id),[va2.id]);assert(!rec.some(x=>x.id===vb.id));
  if(process.env.TEST_LIVE==='1'){
   const base='http://127.0.0.1:3300/xxxkerem';
   const get=async(url:string)=>{const r=await fetch(base+url);assert.equal(r.status,200);return r.text();};
   const html=await get(`/photo/${a1.id}?profileId=${a.id}`);
   assert(html.includes(`/photo/${a2.id}?profileId=${a.id}`));assert(html.includes(`/photo/${a0.id}?profileId=${a.id}`));assert(!html.includes(`/photo/${b1.id}`));
   assert(html.includes(`/profiles/${a.id}?tab=photos`));
   const edge=await get(`/photo/${a2.id}?profileId=${a.id}`);assert(!edge.includes('aria-label="Önceki fotoğraf"'));
   const profile=await get(`/profiles/${a.id}?tab=photos`);assert(profile.includes(`/photo/${a1.id}?profileId=${a.id}`));
   const watch=await get(`/watch/${va.id}?profileId=${a.id}`);assert(watch.includes(`/watch/${va2.id}?profileId=${a.id}`));assert(!watch.includes(`/watch/${vb.id}`));
   assert.equal((await fetch(`${base}/photo/${a1.id}?profileId=${b.id}`)).status,404);
   assert.equal((await fetch(`${base}/watch/${va.id}?profileId=invalid`)).status,404);
  }
  console.log('PASS: profile-only photo neighbors/boundaries, hidden profiles, avatar exclusion, profile video recommendations, global browsing, context links and membership validation');
 }finally{
  await prisma.media.deleteMany({where:{id:{in:ids}}});await prisma.profile.deleteMany({where:{id:{in:[a.id,b.id]}}});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

import 'dotenv/config';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { listMedia, recommendedVideos, listProfiles } from '../lib/queries';
const token = `__visibility_test_${Date.now()}`;
async function main() {
 const visible = await prisma.profile.create({ data: { name: token+'public' } });
 const hidden = await prisma.profile.create({ data: { name: token+'hidden', hidden: true } });
 try {
  for (const kind of ['IMAGE','VIDEO'] as const) {
   const create = (suffix: string, ids: number[], isAvatar=false) => prisma.media.create({data:{kind,path:token+suffix+kind,title:token,mtime:new Date(),isAvatar,profiles:{connect:ids.map(id=>({id}))}}});
   const pub = await create('public',[visible.id]);
   const secret = await create('secret',[hidden.id]);
   const shared = await create('shared',[visible.id,hidden.id]);
   const avatar = await create('avatar',[visible.id],true);
   const lone = await create('lone',[]);
   for (const sort of ['new','views','title','random'] as const) {
    const library = await listMedia({kind,q:token,sort,page:1});
    assert.equal(library.total,2);
    assert.deepEqual(new Set(library.items.map(m=>m.id)),new Set([pub.id,lone.id]));
    const profile = await listMedia({kind,q:token,sort,page:1,profileId:hidden.id});
    assert.deepEqual(new Set(profile.items.map(m=>m.id)),new Set([secret.id,shared.id]));
    const publicProfile = await listMedia({kind,q:token,sort,page:1,profileId:visible.id});
    assert(!publicProfile.items.some(m=>m.id===avatar.id));
   }
   if(kind==='VIDEO') {
    const rec=await recommendedVideos(pub.id,[visible.id]);
    assert(!rec.some(m=>[secret.id,shared.id,avatar.id].includes(m.id)));
   }
  }
  const profiles=await listProfiles(token);
  assert(profiles.find(p=>p.id===hidden.id)?.hidden);
  console.log('PASS: hidden/shared/unassigned/avatar filtering, all sorts, profile access, recommendations');
 } finally {
  await prisma.media.deleteMany({where:{title:token}});
  await prisma.profile.deleteMany({where:{id:{in:[visible.id,hidden.id]}}});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

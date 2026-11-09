import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { MEDIA_DIR, UPLOAD_DIR, PROFILE_DIR, THUMB_DIR } from '../lib/config';
import { requireLibraryMount } from '../lib/scan-safety';
import { DELETE } from '../app/api/media/[id]/route';
const token=`__delete_test_${Date.now()}`;
const created:number[]=[];const files:string[]=[];let profileId:number|undefined;
async function exists(f:string){return fs.access(f).then(()=>true,()=>false)}
async function call(id:string,body:unknown,origin?:string){
 if (process.env.TEST_LIVE === '1' && !origin) return fetch('http://127.0.0.1:3300/xxxkerem/api/media/'+id,{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 return DELETE(new Request('http://localhost/api/media/'+id,{method:'DELETE',headers:{'content-type':'application/json',host:'localhost',...(origin?{origin}:{})},body:JSON.stringify(body)}),{params:Promise.resolve({id})});
}
async function main(){
 requireLibraryMount(MEDIA_DIR);
 for(const root of [UPLOAD_DIR,PROFILE_DIR,THUMB_DIR])await fs.mkdir(root,{recursive:true});
 const profile=await prisma.profile.create({data:{name:token}});profileId=profile.id;
 for(const [kind,root,prefix,ext] of [['IMAGE',MEDIA_DIR,'','.jpg'],['VIDEO',MEDIA_DIR,'','.mp4'],['IMAGE',UPLOAD_DIR,'@uploads/','.png']] as const){
  const name=token+kind+ext;const file=path.join(root,name);files.push(file);await fs.writeFile(file,'disposable test fixture',{flag:'wx'});
  const row=await prisma.media.create({data:{kind,path:prefix+name,title:token,mtime:new Date(),profiles:{connect:{id:profile.id}}}});created.push(row.id);
  const thumb=path.join(THUMB_DIR,`${row.id}.jpg`);files.push(thumb);await fs.writeFile(thumb,'thumb',{flag:'wx'});
  if(kind==='IMAGE'){
   const avatar=path.join(PROFILE_DIR,token+row.id+'.jpg');files.push(avatar);await fs.writeFile(avatar,'avatar',{flag:'wx'});
   await prisma.media.update({where:{id:row.id},data:{avatarFile:'@profil/'+path.basename(avatar)}});
   await prisma.profile.update({where:{id:profile.id},data:{avatarMediaId:row.id}});
  }
  assert.equal((await call(String(row.id),{})).status,400);assert(await exists(file));
  assert.equal((await call(String(row.id),{confirmed:true},'http://other-host')).status,403);assert(await exists(file));
  assert.equal((await call(String(row.id),{confirmed:true})).status,200);
  assert(!await exists(file));assert(!await exists(thumb));
  assert.equal(await prisma.media.findUnique({where:{id:row.id}}),null);
  assert.equal((await prisma.profile.findUniqueOrThrow({where:{id:profile.id}})).avatarMediaId,null);
  assert.equal((await call(String(row.id),{confirmed:true})).status,404);
 }
 assert.equal((await call('invalid',{confirmed:true})).status,400);
 // A symlink to another file must never be followed or removed.
 const outside=path.join(UPLOAD_DIR,token+'-keep');files.push(outside);await fs.writeFile(outside,'keep',{flag:'wx'});
 const link=path.join(MEDIA_DIR,token+'-link.jpg');files.push(link);await fs.symlink(outside,link);
 const row=await prisma.media.create({data:{kind:'IMAGE',path:path.basename(link),title:token,mtime:new Date()}});created.push(row.id);
 assert.equal((await call(String(row.id),{confirmed:true})).status,500);assert(await exists(outside));assert(await prisma.media.findUnique({where:{id:row.id}}));
 console.log('PASS: HDD photo/video and upload deletion; confirmation; cross-origin rejection; avatar/thumbnail cleanup; profile reference reset; invalid/missing IDs; symlink protection');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 if(profileId)await prisma.profile.delete({where:{id:profileId}});
 await prisma.media.deleteMany({where:{id:{in:created}}});
 for(const file of files)await fs.unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e});
 await prisma.$disconnect();
});

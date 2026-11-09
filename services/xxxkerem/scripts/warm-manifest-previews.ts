import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { resolveMediaFile } from '../lib/config';
import { photoPreview } from '../lib/photo-preview';
async function main(){
 const profile=await prisma.profile.findUniqueOrThrow({where:{name:'Manifest Esin'},include:{media:{where:{kind:'IMAGE',isAvatar:false}}}});
 let originalBytes=0,previewBytes=0;
 for(const m of profile.media){
  const file=resolveMediaFile(m.path)!;
  const before=await fs.readFile(file),hash=createHash('sha256').update(before).digest('hex');
  const {data}=await photoPreview(m.id),meta=await sharp(data).metadata();
  assert(meta.width!<=1600&&meta.height!<=1600);
  assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'),hash);
  originalBytes+=before.length;previewBytes+=data.length;
  const start=performance.now();await photoPreview(m.id);
  console.log(JSON.stringify({id:m.id,originalBytes:before.length,previewBytes:data.length,cachedMs:Math.round(performance.now()-start)}));
 }
 console.log(JSON.stringify({photos:profile.media.length,originalBytes,previewBytes,reductionPercent:Math.round((1-previewBytes/originalBytes)*100)}));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { PROFILE_DIR, PROFILE_PREFIX } from '../lib/config';
import { makeImageThumb } from '../lib/scan';
async function main(){
 const p=await prisma.profile.create({data:{name:'Kırpma testi (geçici)'}});
 const name=`ui-test-${Date.now()}.png`;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="400" height="400" fill="#e65a35"/><rect x="400" width="400" height="400" fill="#2578c7"/><circle cx="400" cy="200" r="110" fill="#f8cc55"/><text x="400" y="215" font-size="45" text-anchor="middle">TEST</text></svg>';
 await sharp(Buffer.from(svg)).png().toFile(path.join(PROFILE_DIR,name));
 const m=await prisma.media.create({data:{kind:'IMAGE',path:PROFILE_PREFIX+name,isAvatar:true,title:'Geçici test resmi',mtime:new Date(),profiles:{connect:{id:p.id}}}});
 await makeImageThumb(m.id,path.join(PROFILE_DIR,name));
 await prisma.profile.update({where:{id:p.id},data:{avatarMediaId:m.id}});
 await fs.writeFile('data/avatar-ui-fixture.json',JSON.stringify({id:p.id}));console.log('UI fixture profile:',p.id);
}
main().finally(()=>prisma.$disconnect());

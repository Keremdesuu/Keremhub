import 'dotenv/config';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { deleteMedia } from '../lib/delete-media';
async function main(){
 const {id}=JSON.parse(await fs.readFile('data/avatar-ui-fixture.json','utf8'));
 const profile=await prisma.profile.findUniqueOrThrow({where:{id}});assert.equal(profile.name,'Kırpma testi (geçici)');
 const rows=await prisma.media.findMany({where:{profiles:{some:{id}}}});assert.equal(rows.length,1);assert.equal(profile.avatarMediaId,rows[0].id);
 for(const m of rows)await deleteMedia(m.id);
 await prisma.profile.delete({where:{id}});await fs.unlink('data/avatar-ui-fixture.json');console.log('UI fixture cleaned; cancelling preserved the original avatar');
}
main().finally(()=>prisma.$disconnect());

import 'dotenv/config';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { deleteMedia } from '../lib/delete-media';
async function main(){
 const {id}=JSON.parse(await fs.readFile('data/rotate-ui-fixture.json','utf8'));
 const profile=await prisma.profile.findUniqueOrThrow({where:{id}});assert.equal(profile.name,'Döndürme testi (geçici)');
 const rows=await prisma.media.findMany({where:{profiles:{some:{id}}}});assert.equal(rows.length,1);assert.equal(profile.avatarMediaId,rows[0].id);
 for(const m of rows)await deleteMedia(m.id);
 await prisma.profile.delete({where:{id}});await fs.unlink('data/rotate-ui-fixture.json');console.log('Rotation fixture cleaned');
}
main().finally(()=>prisma.$disconnect());

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {prisma} from '../lib/prisma';
import {THUMB_DIR} from '../lib/config';
async function main(){const state=JSON.parse(await fs.readFile('/tmp/keremhub-player-fixture.json','utf8'));const row=await prisma.media.findUnique({where:{id:state.archiveId}});if(row?.path.startsWith('@uploads/player-check-')&&row.title==='Oynatıcı kontrolü'){await prisma.media.delete({where:{id:row.id}});await fs.rm(state.file,{force:true});for(const ext of ['jpg','webp'])await fs.rm(path.join(THUMB_DIR,`${row.id}.${ext}`),{force:true});}await fs.rm('/tmp/keremhub-player-fixture.json',{force:true});console.log('ARCHIVE_TEST_CLEANED');}
main().finally(()=>prisma.$disconnect());

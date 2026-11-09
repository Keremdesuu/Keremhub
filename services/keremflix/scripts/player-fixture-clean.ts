import 'dotenv/config';
import fs from 'node:fs/promises';
import {prisma} from '../src/lib/db';
async function main(){const state=JSON.parse(await fs.readFile('/tmp/keremhub-player-fixture.json','utf8'));const title=await prisma.title.findUnique({where:{id:state.titleId}});if(title?.folderName.startsWith('__player-check-')&&title.title==='Oynatıcı kontrolü')await prisma.title.delete({where:{id:title.id}});console.log('FLIX_TEST_CLEANED');}
main().finally(()=>prisma.$disconnect());

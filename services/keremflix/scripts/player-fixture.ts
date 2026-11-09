import 'dotenv/config';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/db';
async function main(){const state=JSON.parse(await fs.readFile('/tmp/keremhub-player-fixture.json','utf8'));const title=await prisma.title.create({data:{kind:'MOVIE',folderName:'__player-check-'+randomUUID(),title:'Oynatıcı kontrolü'}});const episode=await prisma.episode.create({data:{titleId:title.id,filePath:state.file,sizeBytes:BigInt((await fs.stat(state.file)).size)}});await fs.writeFile('/tmp/keremhub-player-fixture.json',JSON.stringify({...state,titleId:title.id,episodeId:episode.id}));console.log('FLIX_FIXTURE',episode.id);}
main().finally(()=>prisma.$disconnect());

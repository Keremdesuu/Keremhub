import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma';
import {UPLOAD_DIR,UPLOAD_PREFIX} from '../lib/config';
async function main(){await fs.mkdir(UPLOAD_DIR,{recursive:true});const name=`player-check-${randomUUID()}.mp4`;const file=path.join(UPLOAD_DIR,name);await fs.copyFile('/tmp/keremhub-player-check-20261028.mp4',file);const row=await prisma.media.create({data:{kind:'VIDEO',path:UPLOAD_PREFIX+name,title:'Oynatıcı kontrolü',duration:120,width:640,height:360,mtime:new Date()}});await fs.writeFile('/tmp/keremhub-player-fixture.json',JSON.stringify({archiveId:row.id,file}));console.log('ARCHIVE_FIXTURE',row.id);}
main().finally(()=>prisma.$disconnect());

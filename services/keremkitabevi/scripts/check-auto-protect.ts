import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../src/lib/db";
import {LIBRARY_DIR} from "../src/lib/config";
import {scanLibrary} from "../src/lib/scanner";
const stateFile='/tmp/kitabevi-auto-protect-check.json';
async function main(){
 if(process.argv[2]==='create'){
  const name=`Koruma kontrol ${randomUUID()}.pdf`;
  const r=await fetch('http://127.0.0.1/keremkitabevi/api/upload',{method:'POST',headers:{'X-File-Name':encodeURIComponent(name)},body:'%PDF-1.4\nTest book\n%%EOF'});
  const result=await r.json();assert.equal(r.status,201);assert(result.bookId);
  await fs.writeFile(stateFile,JSON.stringify({id:result.bookId,name}));console.log('TEST_BOOK_ID',result.bookId);return;
 }
 const state=JSON.parse(await fs.readFile(stateFile,'utf8'));
 const select={title:true,description:true,language:true,publisher:true,year:true,seriesIndex:true,metadataLocked:true,coverLocked:true,authorId:true,seriesId:true,genres:{select:{id:true}}} as const;
 try{
  const before=await db.book.findUniqueOrThrow({where:{id:state.id},select});
  assert.equal(before.title,'Elle Düzenlenen Test Kitabı');assert.equal(before.metadataLocked,true);assert.equal(before.coverLocked,true);
  await fs.appendFile(path.join(LIBRARY_DIR,state.name),'\nFile updated after manual edit');
  await scanLibrary({removeMissing:false});
  const after=await db.book.findUniqueOrThrow({where:{id:state.id},select});assert.deepEqual(after,before);
  console.log('MANUAL_EDIT_SURVIVED_CHANGED_FILE_AND_SCAN');
 }finally{
  await db.book.delete({where:{id:state.id}});await fs.rm(path.join(LIBRARY_DIR,state.name),{force:true});await fs.rm(stateFile,{force:true});console.log('TEST_BOOK_REMOVED');
 }
}
main().finally(()=>db.$disconnect());

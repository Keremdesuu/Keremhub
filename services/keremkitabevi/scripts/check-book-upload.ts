import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { saveBookUpload, bookFileName, MAX_BOOK_BYTES } from "../src/lib/book-upload";
const body = (data: Buffer) => new ReadableStream<Uint8Array>({start(c){c.enqueue(data);c.close();}});
async function main(){
 const root=await fs.mkdtemp('/mnt/hdd/keremkitabevi/.upload-check-');
 const pdf=Buffer.from('%PDF-1.4\nUpload test\n%%EOF');
 try {
  const a=await saveBookUpload(root,'Türkçe Kitap.pdf',body(pdf),pdf.length);
  const b=await saveBookUpload(root,'Türkçe Kitap.pdf',body(pdf),pdf.length);
  assert.equal(a.name,'Türkçe Kitap.pdf');assert.equal(b.name,'Türkçe Kitap (2).pdf');
  assert.deepEqual(await fs.readFile(path.join(root,a.name)),pdf);
  for(const n of ['../a.pdf','a/b.epub','a\\b.epub','.hidden.pdf','x.exe'])assert.throws(()=>bookFileName(n));
  await assert.rejects(()=>saveBookUpload(root,'x.pdf',body(Buffer.from('bad')),3));
  await assert.rejects(()=>saveBookUpload(root,'x.pdf',body(pdf),pdf.length+1));
  await assert.rejects(()=>saveBookUpload(root,'x.pdf',body(pdf),MAX_BOOK_BYTES+1));
  assert((await fs.readdir(root)).every(n=>!n.startsWith('.upload-')));
  console.log('BOOK_UPLOAD_CHECKS_PASSED: exact contents, duplicates, paths, signatures, limits, partial cleanup');
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
main();

import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { db } from "../src/lib/db";
import { LIBRARY_DIR } from "../src/lib/config";
async function main(){
 const name=`Yükleme kontrolü ${randomUUID()}.epub`;
 const before=await db.book.findMany({select:{id:true}});
 const z=new AdmZip();
 z.addFile('mimetype',Buffer.from('application/epub+zip'));
 z.addFile('META-INF/container.xml',Buffer.from('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'));
 z.addFile('content.opf',Buffer.from('<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Yükleme Kontrol Kitabı</dc:title><dc:language>tr</dc:language><dc:identifier id="id">upload-test</dc:identifier></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>'));
 z.addFile('chapter.xhtml',Buffer.from('<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Kontrol</title></head><body><p>Kitap yükleme kontrolü.</p></body></html>'));
 const data=z.toBuffer();
 try{
  const r=await fetch('http://127.0.0.1/keremkitabevi/api/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name),'Origin':'http://127.0.0.1'},body:new Uint8Array(data)});
  const result=await r.json();assert.equal(r.status,201,JSON.stringify(result));assert(result.bookId);assert(!result.warning, result.warning);
  const book=await db.book.findUniqueOrThrow({where:{id:result.bookId}});assert.equal(book.relPath,name);assert.equal(book.title,'Yükleme Kontrol Kitabı');assert.deepEqual(await fs.readFile(path.join(LIBRARY_DIR,name)),data);
  const bad=await fetch('http://127.0.0.1/keremkitabevi/api/upload',{method:'POST',headers:{'X-File-Name':'bad.exe'},body:'bad'});assert.equal(bad.status,400);
  console.log('UPLOAD_API_OK: nginx -> HDD -> EPUB metadata -> library');
 }finally{
  const test=await db.book.findUnique({where:{relPath:name}});if(test)await db.book.delete({where:{id:test.id}});
  await fs.rm(path.join(LIBRARY_DIR,name),{force:true});
  const after=new Set((await db.book.findMany({select:{id:true}})).map(x=>x.id));assert(before.every(x=>after.has(x.id)));console.log('TEST_CLEANED; EXISTING_BOOKS_PRESERVED',before.length);
 }
}
main().finally(()=>db.$disconnect());

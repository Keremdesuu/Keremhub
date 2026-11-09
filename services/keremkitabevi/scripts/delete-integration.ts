import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

async function main(){
 const root=process.env.DELETE_TEST_ROOT!;
 assert(root.startsWith('/tmp/kitabevi-delete-integration-'));
 process.chdir(root);
 const {db}=await import('../src/lib/db');
 const {deleteLibraryBook}=await import('../src/lib/delete-book');
 const {GET}=await import('../src/app/kobo/[token]/v1/library/sync/route');
 await fs.mkdir(path.join(root,'data/covers'),{recursive:true});
 await fs.mkdir(path.join(root,'data/kobo'),{recursive:true});
 await fs.mkdir(process.env.LIBRARY_DIR!,{recursive:true});
 const book=await db.book.create({data:{relPath:'fixture.pdf',format:'pdf',sizeBytes:5,mtimeMs:1,title:'Deletion integration fixture',koboSync:true,progress:{create:{location:'fixture',percent:.2}},entry:{create:{status:'reading'}},koboState:{create:{downloadedAt:new Date()}},shelves:{create:{name:'fixture'}}}});
 await fs.writeFile(path.join(process.env.LIBRARY_DIR!,book.relPath),'hello');
 await fs.writeFile(path.join(root,'data/covers',`${book.id}.webp`),'cover');
 await fs.writeFile(path.join(root,'data/kobo',`${book.id}-5-1.kepub.epub`),'cache');
 await db.koboConfig.create({data:{id:1,token:'TEST'}});
 await deleteLibraryBook(book.id);
 assert.equal(await db.book.count(),0);
 assert.equal(await db.progress.count(),0);
 assert.equal(await db.readingEntry.count(),0);
 assert.equal(await db.koboBookState.count(),0);
 assert.equal(await db.koboDeletion.count(),1);
 assert.equal(await db.shelf.count(),1);
 assert.deepEqual(await fs.readdir(process.env.LIBRARY_DIR!),[]);
 assert.deepEqual(await fs.readdir(path.join(root,'data/covers')),[]);
 assert.deepEqual(await fs.readdir(path.join(root,'data/kobo')),[]);
 const call=async(cursor?:string)=>GET(new Request('http://localhost/keremkitabevi/kobo/TEST/v1/library/sync',{headers:cursor?{'x-kobo-synctoken':cursor}:{}}),{params:Promise.resolve({token:'TEST'})});
 const first=await call();assert.equal(first.status,200);const items=await first.json();assert.equal(items.length,1);assert.equal(items[0].ChangedEntitlement.BookEntitlement.IsRemoved,true);
 const second=await call(first.headers.get('x-kobo-synctoken')!);assert.deepEqual(await second.json(),[]);
 assert.equal((await (await call()).json()).length,1);
 await db.$disconnect();
 console.log('PASS real isolated SQLite: cascading deletion, HDD/cache cleanup, persistent Kobo removal and acknowledged replay');
}
main().catch(e=>{console.error(e);process.exitCode=1});

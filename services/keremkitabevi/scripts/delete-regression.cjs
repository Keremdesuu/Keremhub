const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks){const m={exports:{}};vm.runInNewContext(ts.transpileModule(require('fs').readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,require:n=>mocks[n]||require(n),console,Date});return m.exports;}
(async()=>{
const root=await fs.mkdtemp(path.join(os.tmpdir(),'kitabevi-delete-')),library=path.join(root,'library'),data=path.join(root,'data');await fs.mkdir(library);await fs.mkdir(path.join(data,'covers'),{recursive:true});await fs.mkdir(path.join(data,'kobo'));
let book,deleted=false,payload,fail=false;
const db={book:{findUnique:async()=>book},$transaction:async fn=>fn({koboDeletion:{create:async x=>{payload=JSON.parse(x.data.payload)}},book:{delete:async()=>{if(fail)throw Error('DB failure');deleted=true}}})};
const helper=load('src/lib/kobo.ts',{'@/lib/db':{db},'@/lib/config':{BASE_PATH:'/keremkitabevi'}});
const {deleteLibraryBook}=load('src/lib/delete-book.ts',{'./db':{db},'./config':{LIBRARY_DIR:library,DATA_DIR:data,COVERS_DIR:path.join(data,'covers')},'./scan-safety':{requireLibraryMount(){}},'./kobo':helper});
const fixture=async()=>{book={id:919,relPath:'fixture.pdf',title:'Fixture',format:'pdf',sizeBytes:5,addedAt:new Date(),updatedAt:new Date(),author:null,series:null,koboSync:true};deleted=false;await fs.writeFile(path.join(library,book.relPath),'hello');};
await fixture();await fs.writeFile(path.join(data,'covers','919.webp'),'cover');await fs.writeFile(path.join(data,'kobo','919-123.kepub.epub'),'cache');await fs.writeFile(path.join(data,'kobo','9190-123.kepub.epub'),'keep');
await deleteLibraryBook(919);assert(deleted);assert(payload.ChangedEntitlement.BookEntitlement.IsRemoved);assert.equal(payload.ChangedEntitlement.BookEntitlement.Id,helper.bookUuid(919));
for(const file of [path.join(library,'fixture.pdf'),path.join(data,'covers','919.webp'),path.join(data,'kobo','919-123.kepub.epub')])await assert.rejects(fs.access(file));await fs.access(path.join(data,'kobo','9190-123.kepub.epub'));assert.deepEqual(await fs.readdir(library),[]);console.log('PASS HDD source, cover, cache removal and persistent Kobo entitlement');
await fixture();fail=true;await assert.rejects(deleteLibraryBook(919));assert.equal(await fs.readFile(path.join(library,'fixture.pdf'),'utf8'),'hello');assert(!deleted);fail=false;console.log('PASS DB failure restores HDD source');
book.relPath='../outside.pdf';await fs.writeFile(path.join(root,'outside.pdf'),'safe');await assert.rejects(deleteLibraryBook(919));assert.equal(await fs.readFile(path.join(root,'outside.pdf'),'utf8'),'safe');
await fs.symlink(root,path.join(library,'escape'));book.relPath='escape/outside.pdf';await assert.rejects(deleteLibraryBook(919));assert(!deleted);console.log('PASS traversal and symlink-parent rejection');
await fixture();await fs.unlink(path.join(library,'fixture.pdf'));await deleteLibraryBook(919);assert(deleted);console.log('PASS already missing source still creates removal event');
await assert.rejects(deleteLibraryBook(0));book=null;await assert.rejects(deleteLibraryBook(919));
await fs.rm(root,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1});

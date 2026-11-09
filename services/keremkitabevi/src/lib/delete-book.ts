import fs from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {LIBRARY_DIR,COVERS_DIR,DATA_DIR} from "./config";
import {requireLibraryMount} from "./scan-safety";
import {bookUuid,koboMetadata} from "./kobo";

export async function deleteLibraryBook(id:number){
 if(!Number.isSafeInteger(id)||id<1)throw new Error("Geçersiz kitap kimliği.");
 requireLibraryMount(LIBRARY_DIR);
 const book=await db.book.findUnique({where:{id},include:{author:true,series:true,koboState:true}});
 if(!book)throw new Error("Kitap bulunamadı.");
 const root=await fs.realpath(LIBRARY_DIR),source=path.resolve(root,book.relPath);
 if(!source.startsWith(root+path.sep))throw new Error("Geçersiz kitap yolu.");
 // Validate parents even when the source has already been removed externally.
 const parent=await fs.realpath(path.dirname(source));
 if(parent!==root&&!parent.startsWith(root+path.sep))throw new Error("Geçersiz kitap yolu.");
 let staged:string|null=null;
 try{
  const st=await fs.lstat(source);
  if(!st.isFile()||st.isSymbolicLink())throw new Error("Kitap yolu normal bir dosya olmalı.");
  staged=path.join(parent,".delete-"+randomUUID());
  await fs.rename(source,staged);
 }catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
 try{
  await db.$transaction(async tx=>{
   const uuid=bookUuid(id),now=new Date().toISOString();
   // Keep every deletion: metadata might have reached Kobo before download acknowledgement.
   await tx.koboDeletion.create({data:{bookId:id,payload:JSON.stringify({ChangedEntitlement:{
    BookEntitlement:{Accessibility:"Full",ActivePeriod:{From:book.addedAt.toISOString()},Created:book.addedAt.toISOString(),CrossRevisionId:uuid,Id:uuid,IsRemoved:true,IsHiddenFromArchive:true,IsLocked:false,LastModified:now,OriginCategory:"Imported",RevisionId:uuid,Status:"Revoked"},
    BookMetadata:koboMetadata(book,""),
   }})}});
   await tx.book.delete({where:{id}});
  });
 }catch(e){if(staged)await fs.rename(staged,source);throw e;}
 // The DB is committed; do not restore the source and let a scan resurrect it.
 const cleanup=[...(staged?[staged]:[]),path.join(COVERS_DIR,`${id}.webp`)];
 try{for(const name of await fs.readdir(path.join(DATA_DIR,"kobo")))if(name.startsWith(`${id}-`))cleanup.push(path.join(DATA_DIR,"kobo",name));}
 catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")console.error("Kobo önbelleği okunamadı",e);}
 const failures=await Promise.allSettled(cleanup.map(file=>fs.rm(file,{force:true})));
 if(failures.some(x=>x.status==="rejected"))throw new Error("Kitap kaydı kaldırıldı ancak bazı dosyalar temizlenemedi. Sunucu disk izinlerini kontrol edin.");
}

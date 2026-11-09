import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";
import { LIBRARY_DIR, DATA_DIR } from "./config";
const run = promisify(execFile);
type BookFile = { id:number; relPath:string; format:string; sizeBytes:number; mtimeMs:number };
const jobs = new Map<string, Promise<KoboFile>>();
export type KoboFile = { path:string; size:number; unpackedSize:number; format:"KEPUB"|"PDF" };
export async function prepareKoboFile(book:BookFile):Promise<KoboFile> {
 const root=await fs.realpath(LIBRARY_DIR), source=await fs.realpath(path.resolve(root,book.relPath));
 if(!source.startsWith(root+path.sep))throw new Error("Geçersiz kitap yolu");
 const stat=await fs.stat(source),key=`${book.id}-${stat.size}-${Math.trunc(stat.mtimeMs)}`;
 const existing=jobs.get(key);if(existing)return existing;
 const job=(async()=>{
  let file=source;
  if(book.format==="epub"){
   const dir=path.join(DATA_DIR,"kobo");await fs.mkdir(dir,{recursive:true});
   file=path.join(dir,key+".kepub.epub");
   try{await fs.access(file);}catch{
    const tmp=path.join(dir,key+"-"+randomUUID()+".kepub.epub");
    try{await run(process.env.KEPUBIFY_PATH||"/home/kerempi/.local/bin/kepubify",["--output",tmp,source],{timeout:60000,maxBuffer:1024*1024});await fs.rename(tmp,file);}
    finally{await fs.rm(tmp,{force:true});}
   }
  }
  const size=(await fs.stat(file)).size;
  const unpackedSize=book.format==="pdf"?size:new AdmZip(file).getEntries().reduce((sum,e)=>sum+e.header.size,0);
  return {path:file,size,unpackedSize,format:book.format==="pdf"?"PDF":"KEPUB"} as KoboFile;
 })();jobs.set(key,job);
 try{return await job;}finally{jobs.delete(key);}
}

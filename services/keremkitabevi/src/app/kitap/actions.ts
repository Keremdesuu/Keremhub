"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {db} from "@/lib/db";
import fs from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {COVERS_DIR} from "@/lib/config";
type State={error?:string};
function num(v:FormDataEntryValue|null){const s=String(v??"").trim();if(!s)return {value:null,invalid:false};const n=Number(s);return {value:n,invalid:!Number.isFinite(n)}}
export async function updateBookMetadata(_state:State,form:FormData):Promise<State>{
const id=Number(form.get("id")),title=String(form.get("title")??"").replace(/\s+/g," ").trim();
if(!Number.isSafeInteger(id)||id<1)return {error:"Kitap kaydı bulunamadı."};
if(!title)return {error:"Kitap adı boş bırakılamaz."};
const year=num(form.get("year")),index=num(form.get("seriesIndex"));
if(year.invalid||(year.value!==null&&(!Number.isInteger(year.value)||year.value<0||year.value>9999)))return {error:"Yayın yılı 0–9999 arasında tam sayı olmalı."};
if(index.invalid)return {error:"Seri sırası geçerli bir sayı olmalı."};
const author=String(form.get("author")??"").replace(/\s+/g," ").trim(),series=String(form.get("series")??"").replace(/\s+/g," ").trim();
const genres=[...new Map(String(form.get("genres")??"").split(/[\n,]/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean).map(x=>[x.toLocaleLowerCase("tr"),x] as const)).values()];
const cover=form.get("cover");
let coverBuffer:Buffer|null=null,previousCover:Buffer|null=null;
const coverPath=path.join(COVERS_DIR,`${id}.webp`);
if(cover instanceof File && cover.size>0){
 if(cover.size>12*1024*1024)return {error:"Kapak en fazla 12 MB olabilir."};
 try{coverBuffer=await sharp(Buffer.from(await cover.arrayBuffer()),{limitInputPixels:40000000}).rotate().resize({width:1200,withoutEnlargement:true}).webp({quality:90}).toBuffer();}
 catch{return {error:"Kapak geçerli bir görsel değil."};}
}
try{
 if(coverBuffer){
  await fs.mkdir(COVERS_DIR,{recursive:true});
  try{previousCover=await fs.readFile(coverPath);}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
  const tmp=coverPath+"."+randomUUID()+".tmp";
  try{await fs.writeFile(tmp,coverBuffer);await fs.rename(tmp,coverPath);}finally{await fs.rm(tmp,{force:true});}
 }
 await db.book.update({where:{id},data:{
title,description:String(form.get("description")??"").trim()||null,language:String(form.get("language")??"").trim()||null,publisher:String(form.get("publisher")??"").trim()||null,
year:year.value,seriesIndex:index.value,coverLocked:true,...(coverBuffer?{hasCover:true}:{}),metadataLocked:true,
author:author?{connectOrCreate:{where:{name:author},create:{name:author}}}:{disconnect:true},
series:series?{connectOrCreate:{where:{name:series},create:{name:series}}}:{disconnect:true},
genres:{set:[],connectOrCreate:genres.map(name=>({where:{name},create:{name}}))}
}})}catch{
 if(coverBuffer){if(previousCover)await fs.writeFile(coverPath,previousCover);else await fs.rm(coverPath,{force:true});}
 return {error:"Değişiklikler kaydedilemedi. Sayfayı yenileyip tekrar deneyin."}}
revalidatePath("/");revalidatePath("/kutuphane");revalidatePath("/kitap/"+id);redirect("/kitap/"+id);
}

export async function deleteBook(_state:State,form:FormData):Promise<State>{
 if(form.get("confirm")!=="yes")return {error:"Silme işlemini onaylayın."};
 try{await (await import("@/lib/delete-book")).deleteLibraryBook(Number(form.get("id")));}
 catch(error){console.error("Kitap silinemedi",error);return {error:error instanceof Error?error.message:"Kitap silinemedi."};}
 revalidatePath("/","layout");redirect("/kutuphane");
}

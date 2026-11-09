import {db} from "./db";
export type MetadataOptions={authors:string[];series:string[];genres:string[];languages:string[];publishers:string[]};
const collator=new Intl.Collator("tr",{sensitivity:"base",numeric:true});
function unique(values:(string|null)[]){return [...new Set(values.map(value=>(value||"").normalize("NFC").trim()).filter(Boolean))].sort(collator.compare);}
export async function getMetadataOptions():Promise<MetadataOptions>{
 const [authors,series,genres,books]=await Promise.all([
  db.author.findMany({select:{name:true}}),
  db.series.findMany({select:{name:true}}),
  db.genre.findMany({select:{name:true}}),
  db.book.findMany({select:{language:true,publisher:true}}),
 ]);
 return {authors:unique(authors.map(x=>x.name)),series:unique(series.map(x=>x.name)),genres:unique(genres.map(x=>x.name)),languages:unique(books.map(x=>x.language)),publishers:unique(books.map(x=>x.publisher))};
}

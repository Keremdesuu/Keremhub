import "dotenv/config";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {searchBooks,parseFilters} from "../src/lib/queries";
import {normalizeSearch,matchesSearch} from "../src/lib/search";
async function main(){
 const book=await db.book.findUniqueOrThrow({where:{id:773},include:{author:true,series:true}});
 for(const query of ["Şeytanlar","şeytanlar","ŞEYTANLAR","Seytanlar","SEYTANLAR","S\u0327eytanlar","  şeytanlar  ","Şeytanlar Joe","Joe Abercrombie", "şeytanlar solo"]){
  const result=await searchBooks(parseFilters({q:query}));
  assert(result.books.some(row=>row.id===book.id),query);console.log('PASS',query);
 }
 assert.equal(normalizeSearch('IŞIK İÇİN ÇÖĞÜŞ'),'isik icin cogus');
 assert(matchesSearch('ışık için',['ISIK ICIN']));console.log('PASS dotted/dotless I and accents');
 const filters=parseFilters({q:'şeytanlar',yazar:String(book.authorId)});assert((await searchBooks(filters)).books.some(row=>row.id===773));
 assert.equal((await searchBooks({...filters,author:999999})).total,0);
 assert.equal((await searchBooks({...filters,format:'pdf'})).total,0);console.log('PASS author and format filters preserved');
 const result=await searchBooks({...parseFilters({q:'seyTanlar',sayfa:'999'}),author:book.authorId!});assert.equal(result.total,1);assert.equal(result.page,1);assert.equal(result.pages,1);console.log('PASS result totals and page clamping');
 assert.equal((await searchBooks(parseFilters({q:'nonexistentbookzzzxxyy'}))).total,0);console.log('PASS nonmatching query remains empty');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());

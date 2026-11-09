import "dotenv/config";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {getMetadataOptions} from "../src/lib/metadata-options";
import {completionOptions,insertCompletion} from "../src/lib/metadata-completion";
async function main(){
 const options=await getMetadataOptions();
 assert(options.series.includes('Dune'));assert(options.authors.includes('Joe Abercrombie'));
 for(const [name,values] of Object.entries(options)){assert.equal(new Set(values).size,values.length);assert(values.every(value=>value.trim()===value&&value.length>0));console.log('OPTIONS_OK',name,values.length);}
 assert.deepEqual(completionOptions(['Şehir Fantastiği','Bilim Kurgu'],'sehir'),['Şehir Fantastiği']);
 assert.deepEqual(completionOptions(['Dune','Dune Evreni'],'DUN'),['Dune','Dune Evreni']);console.log('PASS Turkish and case-insensitive suggestions');
 const value='Fantastik, bilim k, Macera';const middle=insertCompletion(value,'Bilim Kurgu',true,value.indexOf('bilim')+3);assert.equal(middle.value,'Fantastik, Bilim Kurgu, Macera');assert.equal(middle.value.slice(0,middle.caret),'Fantastik, Bilim Kurgu');console.log('PASS choosing middle genre preserves both neighbors');
 assert.equal(insertCompletion('Fantastik, bi','Bilim Kurgu',true).value,'Fantastik, Bilim Kurgu');assert.equal(insertCompletion('bi, Macera','Bilim Kurgu',true,1).value,'Bilim Kurgu, Macera');console.log('PASS first and last genre completion');
 assert.deepEqual(completionOptions(['Fantastik','Macera'],'Fantastik, ',true),['Macera']);assert.equal(insertCompletion('','Yeni Seri').value,'Yeni Seri');console.log('PASS existing genres excluded and free text allowed');
 assert.deepEqual(completionOptions(['Fantastik'],', ',true,0),['Fantastik']);console.log('PASS empty leading genre token');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());

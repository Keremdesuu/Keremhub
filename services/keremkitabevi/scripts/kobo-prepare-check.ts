import "dotenv/config";
import {db} from "../src/lib/db";
import {prepareKoboFile} from "../src/lib/kobo-files";
import AdmZip from "adm-zip";
async function main(){
const book=await db.book.findUniqueOrThrow({where:{id:818}});
const file=await prepareKoboFile(book);
const zip=new AdmZip(file.path),html=zip.getEntries().filter(e=>/\.(xhtml|html|htm)$/.test(e.entryName));
if(!html.some(e=>zip.readAsText(e).includes('koboSpan')))throw new Error("No Kobo spans found");
console.log(JSON.stringify({event:"kobo.prepare.verified",bookId:book.id,format:file.format,size:file.size,unpackedSize:file.unpackedSize,koboSpans:true}));
await db.$disconnect();

}
main().catch(async error=>{console.error(error);await db.$disconnect();process.exitCode=1;});

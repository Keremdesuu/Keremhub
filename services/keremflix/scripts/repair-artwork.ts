import "dotenv/config";
import {prisma} from "../src/lib/db";
import {fetchMetadata} from "../src/lib/metadata";
import {needsMetadata} from "../src/lib/metadata-policy";
import {renderArtwork} from "../src/lib/artwork";
import sharp from "sharp";
async function main(){
 const old=await prisma.title.findMany({orderBy:{id:"asc"}});
 for(const row of old){
  if(!needsMetadata(row))continue;
  const result=await fetchMetadata(row.kind,row.originalTitle||row.title,row.year);
  if(result.meta){const m=result.meta;await prisma.title.update({where:{id:row.id},data:{posterUrl:m.posterUrl||row.posterUrl,backdropUrl:m.backdropUrl||(row.backdropUrl!==row.posterUrl?row.backdropUrl:null),metaStatus:result.status}});}
  console.log('METADATA_REFRESH',row.id,row.title,result.status);
 }
 const rows=await prisma.title.findMany();let completed=0,failed=0;
 await Promise.all(rows.map(async row=>{for(const role of ['poster','card','hero'] as const){
  try{const output=await renderArtwork(row,role),m=await sharp(output).metadata();console.log('ARTWORK_OK',row.id,role,m.width,m.height);completed++;}
  catch(error){console.log('ARTWORK_FAILED',row.id,role,String(error));failed++;}
 }}));
 console.log('ARTWORK_TOTAL',completed,'FAILED',failed);
 if(failed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());

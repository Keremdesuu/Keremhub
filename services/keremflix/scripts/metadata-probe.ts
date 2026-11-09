import "dotenv/config";
import {fetchMetadata} from "../src/lib/metadata";
async function main(){for(const [kind,title,year] of [["MOVIE","Whiplash",2014],["MOVIE","Set It Up",2018],["SERIES","Black Mirror",2011]] as const){const result=await fetchMetadata(kind,title,year);console.log(JSON.stringify({title,status:result.status,matched:result.meta?.title,poster:Boolean(result.meta?.posterUrl),backdrop:Boolean(result.meta?.backdropUrl)}));}}
main().catch(error=>{console.error(error);process.exitCode=1;});

import "dotenv/config";
import assert from "node:assert/strict";
import { shuffled, shuffleSeed } from "../lib/shuffle";
import { listMedia, randomMedia, recommendedVideos, parseSort, mediaInclude } from "../lib/queries";
import { prisma } from "../lib/prisma";
async function main() {
 const ids=Array.from({length:100},(_,i)=>i+1), copy=[...ids];
 assert.deepEqual(shuffled(ids,"one"),shuffled(ids,"one"));
 assert.notDeepEqual(shuffled(ids,"one"),shuffled(ids,"two"));
 assert.deepEqual(ids,copy); assert.equal(new Set(shuffled(ids,"one")).size,100);
 assert.deepEqual(shuffled([],"one"),[]);assert.deepEqual(shuffled([1],"one"),[1]);
 assert.equal(parseSort("random"),"random");assert.notEqual(shuffleSeed("!invalid"),"!invalid");
 const a=await listMedia({kind:"VIDEO",sort:"random",seed:"page-test",page:1,pageSize:12});
 const b=await listMedia({kind:"VIDEO",sort:"random",seed:"page-test",page:2,pageSize:12});
 const again=await listMedia({kind:"VIDEO",sort:"random",seed:"page-test",page:1,pageSize:12});
 assert.deepEqual(a.items.map(x=>x.id),again.items.map(x=>x.id));
 assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,a.items.length+b.items.length);
 assert.equal((await randomMedia({kind:"VIDEO",id:-1},8)).items.length,0);
 const first=await prisma.media.findFirst({where:{kind:"VIDEO"},include:mediaInclude});
 if(first){ const signatures=new Set<string>(); for(let i=0;i<5;i++){ const rec=await recommendedVideos(first.id,first.profiles.map(p=>p.id)); assert(rec.length<=8);assert(rec.every(x=>x.kind==="VIDEO"&&x.id!==first.id));assert.equal(new Set(rec.map(x=>x.id)).size,rec.length); signatures.add(rec.map(x=>x.id).join(",")); } console.log("RECOMMENDATION_VARIANTS",signatures.size); }
 for(const kind of ["VIDEO","IMAGE"] as const){const rows=await listMedia({kind,sort:"random",seed:"filter-test",page:1,unassigned:true}); assert(rows.items.every(x=>!x.profiles.length));}
 console.log("RANDOM_CHECKS_PASSED",a.total,"videos");
}
main().finally(()=>prisma.$disconnect());

import {execFile} from "node:child_process";
import {promisify} from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import {createHash,randomUUID} from "node:crypto";
const exec=promisify(execFile);
export type SubtitleStream={index:number;label:string;language:string;supported:boolean};
const supported=new Set(["subrip","ass","ssa","webvtt","mov_text","text"]);
const cache=new Map<string,Promise<SubtitleStream[]>>();
export async function subtitleStreams(file:string){
 const stat=await fs.stat(file);const key=`${file}:${stat.mtimeMs}:${stat.size}`;
 let value=cache.get(key);if(!value){
 value=exec("ffprobe",["-v","error","-select_streams","s","-show_entries","stream=index,codec_name:stream_tags=language,title","-of","json",file],{timeout:15000,maxBuffer:1024*1024}).then(({stdout})=>{
 const data=JSON.parse(stdout) as {streams:{index:number;codec_name:string;tags?:{language?:string;title?:string}}[]};
 return data.streams.map(s=>({index:s.index,language:s.tags?.language||"und",label:[s.tags?.title,s.tags?.language,`#${s.index}`].filter(Boolean).join(" · "),supported:supported.has(s.codec_name)}));
 });cache.set(key,value);if(cache.size>100)cache.delete(cache.keys().next().value!);value.catch(()=>cache.delete(key));
 }return value;
}
const extracted=new Map<string,Promise<string>>();
let lastPrune=0;
async function pruneSubtitleCache(directory:string){
 if(Date.now()-lastPrune<60000)return;lastPrune=Date.now();
 const entries=await fs.readdir(directory);const files=await Promise.all(entries.filter(name=>/^[a-f0-9]{64}\.vtt$/.test(name)).map(async name=>{const full=path.join(directory,name),stat=await fs.stat(full);return {full,size:stat.size,time:stat.mtimeMs};}));
 files.sort((a,b)=>b.time-a.time);let total=0;
 for(const file of files){total+=file.size;if(total>128*1024*1024||Date.now()-file.time>30*86400000)await fs.unlink(file.full).catch(()=>{});}
}
export async function extractSubtitle(file:string,index:number){
 const stat=await fs.stat(file);const key=`v2:${file}:${stat.mtimeMs}:${stat.size}:${index}`;
 let value=extracted.get(key);
 if(!value){value=(async()=>{
  const directory=process.env.SUBTITLE_CACHE_DIR??path.join(process.cwd(),"data","subtitle-cache");
  const cached=path.join(directory,createHash("sha256").update(key).digest("hex")+".vtt");
  try{const size=(await fs.stat(cached)).size;if(size<=16*1024*1024){const text=await fs.readFile(cached,"utf8");if(text.startsWith("WEBVTT")){void fs.utimes(cached,new Date(),new Date()).catch(()=>{});return text;}}}catch{}
  const {stdout}=await exec("ffmpeg",["-nostdin","-v","error","-discard","all",`-discard:${index}`,"none","-i",file,"-map",`0:${index}`,"-f","webvtt","pipe:1"],{timeout:60000,maxBuffer:16*1024*1024});
  if(!stdout.startsWith("WEBVTT"))throw new Error("Invalid subtitle output");
  const temporary=cached+"."+randomUUID()+".tmp";
  try{await fs.mkdir(directory,{recursive:true});await fs.writeFile(temporary,stdout,{flag:"wx"});await fs.rename(temporary,cached);await pruneSubtitleCache(directory);}catch{}finally{await fs.unlink(temporary).catch(()=>{});}
  return stdout;
 })();extracted.set(key,value);if(extracted.size>16)extracted.delete(extracted.keys().next().value!);value.catch(()=>extracted.delete(key));}
 return value;
}

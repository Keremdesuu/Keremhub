import {execFile,spawn} from "node:child_process";
import {promisify} from "node:util";
import {Readable} from "node:stream";
import fs from "node:fs/promises";
import {normalizeAudioLanguage,audioLanguageLabel,type AudioStream} from "./audio-language";
const exec=promisify(execFile);
const cache=new Map<string,Promise<{streams:AudioStream[];duration:number}>>();
export async function probeAudio(file:string){
 const stat=await fs.stat(file);const key=`${file}:${stat.mtimeMs}:${stat.size}`;let value=cache.get(key);
 if(!value){value=exec("ffprobe",["-v","error","-select_streams","a","-show_entries","stream=index,channels:stream_tags=language,title:stream_disposition=default:format=duration","-of","json",file],{timeout:15000,maxBuffer:1024*1024}).then(({stdout})=>{
 const data=JSON.parse(stdout) as {streams:{index:number;channels?:number;tags?:{language?:string;title?:string};disposition?:{default?:number}}[];format?:{duration?:string}};
 return {duration:Number(data.format?.duration)||0,streams:data.streams.map(s=>({index:s.index,language:normalizeAudioLanguage(s.tags?.language||"und"),label:audioLanguageLabel(s.tags?.language||"und"),title:s.tags?.title||"",channels:s.channels??0,isDefault:!!s.disposition?.default}))};
 });cache.set(key,value);if(cache.size>100)cache.delete(cache.keys().next().value!);value.catch(()=>cache.delete(key));}return value;
}
const workers=new Set<ReturnType<typeof spawn>>();
export class AudioBusyError extends Error{}
export async function streamAudio(file:string,index:number,start:number,signal:AbortSignal){
 if(signal.aborted)throw new Error("Aborted");
 if(workers.size>=3)throw new AudioBusyError();
 const child=spawn("ffmpeg",["-nostdin","-v","error","-threads","1","-ss",String(start),"-i",file,"-map",`0:${index}`,"-vn","-sn","-dn","-ac","2","-ar","48000","-c:a","libmp3lame","-b:a","192k","-write_xing","0","-f","mp3","pipe:1"],{stdio:["ignore","pipe","pipe"]});
 workers.add(child);child.stderr.resume();
 const stop=()=>{if(child.exitCode===null){child.kill("SIGTERM");const hard=setTimeout(()=>{if(child.exitCode===null)child.kill("SIGKILL");},2000);hard.unref();child.once("close",()=>clearTimeout(hard));}};
 signal.addEventListener("abort",stop,{once:true});
 child.once("close",()=>{workers.delete(child);signal.removeEventListener("abort",stop);});
 try{await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>{stop();finish(new Error("Audio timeout"));},15000);
  const ready=()=>finish();const failed=()=>finish(new Error("Audio unavailable"));
  function finish(error?:Error){clearTimeout(timer);child.stdout.removeListener("readable",ready);child.removeListener("error",failed);child.stdout.removeListener("end",failed);signal.removeEventListener("abort",failed);error?reject(error):resolve();}
  child.stdout.once("readable",ready);child.stdout.once("end",failed);child.once("error",failed);signal.addEventListener("abort",failed,{once:true});
 });}catch(error){stop();throw error;}
 return Readable.toWeb(child.stdout) as ReadableStream;
}

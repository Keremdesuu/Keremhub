import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {audioLanguageLabel} from "./audio-language";
import {extractSubtitle} from "./subtitles";
export interface ExternalSubtitle {id:string;language:string;label:string;filename:string;version:string;filePath:string}
const extensions=new Set([".srt",".vtt",".ass",".ssa"]);
const videos=new Set([".mp4",".m4v",".mkv",".avi",".mov",".webm",".ts"]);
const languages:Record<string,string>={tr:"tr",tur:"tr",turkish:"tr",türkçe:"tr",turkce:"tr",en:"en",eng:"en",english:"en",ingilizce:"en",de:"de",deu:"de",ger:"de",german:"de",almanca:"de",fr:"fr",fra:"fr",fre:"fr",french:"fr",es:"es",spa:"es",spanish:"es",it:"it",ita:"it",italian:"it",ja:"ja",jpn:"ja",japanese:"ja",ko:"ko",kor:"ko",korean:"ko",ru:"ru",rus:"ru",russian:"ru",pt:"pt",por:"pt",portuguese:"pt",ar:"ar",ara:"ar",arabic:"ar",zh:"zh",zho:"zh",chi:"zh",chinese:"zh",fa:"fa",fas:"fa",per:"fa",nl:"nl",nld:"nl",dut:"nl",pl:"pl",pol:"pl",uk:"uk",ukr:"uk",sv:"sv",swe:"sv",el:"el",ell:"el",gre:"el",hi:"hi",hin:"hi"};
const qualifiers=new Set(["forced","zorunlu","sdh","cc","full","default","altyazi","altyazı","subtitles","subtitle"]);
const normalized=(value:string)=>value.normalize("NFKC").toLowerCase().replace(/[._\-\s]+/g," ").trim();
export function externalSubtitleMatch(videoName:string,subtitleName:string,singleVideo:boolean){
 const base=normalized(path.parse(videoName).name),name=normalized(path.parse(subtitleName).name);
 let suffix:string;
 if(name===base)suffix="";
 else if(name.startsWith(base+" "))suffix=name.slice(base.length+1);
 else if(singleVideo)suffix=name;
 else return null;
 const tokens=suffix.split(" ").filter(Boolean);
 if(!singleVideo&&tokens.some(t=>!languages[t]&&!qualifiers.has(t)))return null;
 let language="und";
 for(let i=tokens.length-1;i>=0;i--){if(languages[tokens[i]]){language=languages[tokens[i]];break;}if(!qualifiers.has(tokens[i]))break;}
 return {language,forced:tokens.some(t=>t==="forced"||t==="zorunlu")};
}
export async function externalSubtitles(video:string):Promise<ExternalSubtitle[]>{
 const directory=path.dirname(video),entries=await fs.readdir(directory,{withFileTypes:true});
 const singleVideo=entries.filter(e=>e.isFile()&&videos.has(path.extname(e.name).toLowerCase())).length===1;
 const found=await Promise.all(entries.filter(e=>e.isFile()&&extensions.has(path.extname(e.name).toLowerCase())).map(async entry=>{
  const match=externalSubtitleMatch(path.basename(video),entry.name,singleVideo);if(!match)return null;
  const filePath=path.join(directory,entry.name),stat=await fs.stat(filePath);if(stat.size>16*1024*1024)return null;
  return {id:createHash("sha256").update(entry.name).digest("hex").slice(0,24),language:match.language,label:(match.language==="und"?"Harici altyazı":audioLanguageLabel(match.language))+(match.forced?" · Zorunlu":""),filename:entry.name,filePath,version:createHash("sha256").update(`${stat.mtimeMs}:${stat.size}`).digest("hex").slice(0,16)};
 }));
 return found.filter((item):item is ExternalSubtitle=>item!==null).sort((a,b)=>{const rank=(s:ExternalSubtitle)=>s.language==="tr"?0:s.language==="en"?1:2;return rank(a)-rank(b)||a.filename.localeCompare(b.filename,"tr");});
}
export function subtitleTextToVtt(bytes:Buffer,extension:string){
 let text:string;
 if(bytes[0]===0xff&&bytes[1]===0xfe)text=new TextDecoder("utf-16le").decode(bytes);
 else if(bytes[0]===0xfe&&bytes[1]===0xff)text=new TextDecoder("utf-16be").decode(bytes);
 else try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{text=new TextDecoder("windows-1254").decode(bytes);}
 text=text.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n");
 if(extension.toLowerCase()===".vtt")return text.startsWith("WEBVTT")?text:"WEBVTT\n\n"+text;
 return "WEBVTT\n\n"+text.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g,"$1.$2");
}
export async function readExternalSubtitle(video:string,subtitle:ExternalSubtitle){
 const [directory,real]=await Promise.all([fs.realpath(path.dirname(video)),fs.realpath(subtitle.filePath)]);
 if(path.dirname(real)!==directory)throw new Error("Subtitle outside video directory");
 const stat=await fs.stat(real);if(!stat.isFile()||stat.size>16*1024*1024)throw new Error("Invalid subtitle file");
 const extension=path.extname(real).toLowerCase();
 if(extension===".srt"||extension===".vtt")return subtitleTextToVtt(await fs.readFile(real),extension);
 return extractSubtitle(real,0);
}

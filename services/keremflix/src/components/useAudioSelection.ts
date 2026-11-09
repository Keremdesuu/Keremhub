"use client";
import {useEffect,useRef,useState,type RefObject} from "react";
import {withBase} from "@/lib/base";
import {normalizeAudioLanguage,preferredAudioStream,type AudioStream} from "@/lib/audio-language";
const PREF_KEY="keremflix.audio-language.v1";
type NativeAudioTrack={enabled:boolean;language:string};
type NativeAudioList={length:number;[index:number]:NativeAudioTrack};
export function useAudioSelection(video:RefObject<HTMLVideoElement|null>,audio:RefObject<HTMLAudioElement|null>,episodeId:number,volume:number,muted:boolean){
 const [streams,setStreams]=useState<AudioStream[]>([]),[selected,setSelected]=useState<number|null>(null),[external,setExternal]=useState(false),[status,setStatus]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
 const controller=useRef<{select:(index:number)=>void}|null>(null);
 const settings=useRef({volume,muted});settings.current={volume,muted};
 useEffect(()=>{const a=audio.current;if(a){a.volume=volume;a.muted=muted;}},[volume,muted,audio]);
 useEffect(()=>{
  const v=video.current,a=audio.current;if(!v||!a)return;
  const abort=new AbortController();let catalog:AudioStream[]=[],defaultIndex:number|null=null,current:number|null=null,usingExternal=false,loading=false,offset=0,disposed=false,initialApplied=false,manual=false,generation=0,lastRestart=0;
  let readyHandler:(()=>void)|null=null,timeout:ReturnType<typeof setTimeout>|undefined;
  let rememberPending:number|null=null;
  setStreams([]);setSelected(null);setExternal(false);setStatus("Ses dilleri yükleniyor…");setNotice(null);
  const remember=(stream:AudioStream)=>{try{const code=normalizeAudioLanguage(stream.language);if(code!=="und")localStorage.setItem(PREF_KEY,code);else localStorage.removeItem(PREF_KEY);}catch{}};
  const nativeList=()=>((v as unknown as {audioTracks?:NativeAudioList}).audioTracks);
  const nativeSwitch=(index:number)=>{
   const list=nativeList();let position=catalog.findIndex(s=>s.index===index);if(!list||list.length!==catalog.length||position<0)return false;
   const language=catalog[position].language,nativeLanguage=normalizeAudioLanguage(list[position].language||"und");
   if(language!=="und"&&nativeLanguage!=="und"&&nativeLanguage!==language){const matches=Array.from({length:list.length},(_,i)=>i).filter(i=>normalizeAudioLanguage(list[i].language||"und")===language);if(matches.length!==1)return false;position=matches[0];}
   try{for(let i=0;i<list.length;i++)list[i].enabled=i===position;return list[position].enabled;}catch{return false;}
  };
  const clearLoading=()=>{clearTimeout(timeout);if(readyHandler)a.removeEventListener("canplay",readyHandler);readyHandler=null;};
  const stopExternal=()=>{generation++;clearLoading();a.pause();a.removeAttribute("src");a.load();usingExternal=false;loading=false;setExternal(false);v.muted=settings.current.muted;};
  const fail=()=>{
   if(disposed)return;stopExternal();if(defaultIndex!==null)nativeSwitch(defaultIndex);current=defaultIndex;setSelected(defaultIndex);setStatus(null);setNotice("Ses dili değiştirilemedi. Varsayılan ses kullanılacak.");
  };
  const inBuffer=(time:number)=>{for(let i=0;i<a.buffered.length;i++)if(time>=a.buffered.start(i)&&time<a.buffered.end(i))return true;return false;};
  const playAudio=()=>{const token=generation;if(!v.paused&&!v.ended&&!v.seeking&&v.readyState>=3)a.play().catch(error=>{if(!disposed&&usingExternal&&token===generation&&error.name!=="AbortError")fail();});};
  const startExternal=(index:number)=>{
   clearLoading();generation++;const token=generation;loading=true;offset=Math.max(0,v.currentTime);lastRestart=performance.now();
   a.pause();a.volume=settings.current.volume;a.muted=settings.current.muted;a.playbackRate=v.playbackRate;
   setStatus("Ses hazırlanıyor…");
   readyHandler=()=>{
    if(disposed||token!==generation||a.readyState<3)return;
    clearLoading();loading=false;
    const target=Math.max(0,v.currentTime-offset);if(target>0.05&&inBuffer(target))try{a.currentTime=target;}catch{}
    usingExternal=true;setExternal(true);v.muted=true;setStatus(null);
    if(rememberPending===index){const stream=catalog.find(s=>s.index===index);if(stream)remember(stream);rememberPending=null;}
    playAudio();
   };
   a.addEventListener("canplay",readyHandler);timeout=setTimeout(fail,20000);
   a.src=withBase(`/api/audio/${episodeId}?stream=${index}&start=${offset.toFixed(3)}`);a.load();
  };
  const select=(index:number,persist:boolean)=>{
   const stream=catalog.find(s=>s.index===index);if(!stream||disposed)return;
   setNotice(null);current=index;setSelected(index);rememberPending=persist?index:null;
   if(catalog.length<=1||nativeSwitch(index)||index===defaultIndex){
    stopExternal();setStatus(null);if(persist)remember(stream);rememberPending=null;
   }else startExternal(index);
  };
  controller.current={select:index=>{manual=true;initialApplied=true;select(index,true);}};
  const applyInitial=()=>{
   if(initialApplied||manual||!catalog.length||v.readyState<1)return;initialApplied=true;
   let language:string|null=null;try{language=localStorage.getItem(PREF_KEY);}catch{}
   const stream=preferredAudioStream(catalog,language);if(catalog.length>1&&stream&&stream.index!==defaultIndex)select(stream.index,false);
  };
  const sync=()=>{
   if(disposed||!usingExternal||loading||v.seeking)return;
   if(v.paused||v.ended||v.readyState<3){a.pause();return;}
   const target=v.currentTime-offset,drift=a.currentTime-target;
   if(Math.abs(drift)>0.35){
    if(target>=0&&inBuffer(target)){try{a.currentTime=target;}catch{}}
    else if(current!==null&&performance.now()-lastRestart>1500){startExternal(current);return;}
   }
   a.playbackRate=Math.min(16,Math.max(0.1,v.playbackRate*(drift>0.08?0.98:drift<-.08?1.02:1)));playAudio();
  };
  const pause=()=>a.pause();
  const seeked=()=>{if((usingExternal||loading)&&current!==null)startExternal(current);};
  const onError=()=>{if((usingExternal||loading)&&a.getAttribute("src"))fail();};
  const timer=setInterval(sync,250);
  v.addEventListener("loadedmetadata",applyInitial);v.addEventListener("playing",sync);v.addEventListener("pause",pause);v.addEventListener("waiting",pause);v.addEventListener("seeking",pause);v.addEventListener("ended",pause);v.addEventListener("seeked",seeked);v.addEventListener("ratechange",sync);a.addEventListener("error",onError);
  fetch(withBase(`/api/audio/${episodeId}`),{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
   if(disposed)return;catalog=data.streams;defaultIndex=data.defaultIndex;current=defaultIndex;setStreams(catalog);setSelected(defaultIndex);setStatus(null);applyInitial();
  }).catch(()=>{if(!disposed){setStatus(null);setNotice("Ses dilleri okunamadı. Mevcut sesle oynatılıyor.");}});
  return ()=>{
   disposed=true;abort.abort();clearInterval(timer);clearLoading();generation++;controller.current=null;
   v.removeEventListener("loadedmetadata",applyInitial);v.removeEventListener("playing",sync);v.removeEventListener("pause",pause);v.removeEventListener("waiting",pause);v.removeEventListener("seeking",pause);v.removeEventListener("ended",pause);v.removeEventListener("seeked",seeked);v.removeEventListener("ratechange",sync);a.removeEventListener("error",onError);
   a.pause();a.removeAttribute("src");a.load();v.muted=settings.current.muted;
  };
 },[video,audio,episodeId]);
 return {streams,selected,external,status,notice,select:(index:number)=>controller.current?.select(index)};
}

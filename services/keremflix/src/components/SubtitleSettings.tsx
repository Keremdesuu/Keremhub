"use client";
import {useEffect,useState} from "react";
export interface SubtitlePreferences {background:boolean;fontSize:number;position:number}
export const DEFAULT_SUBTITLE_PREFERENCES:SubtitlePreferences={background:true,fontSize:26,position:85};
const KEY="keremflix.subtitle-preferences.v1";
function numberInRange(value:unknown,min:number,max:number,fallback:number){return typeof value==="number"&&Number.isFinite(value)?Math.min(max,Math.max(min,Math.round(value))):fallback;}
export function useSubtitlePreferences(){
 const [preferences,setPreferences]=useState<SubtitlePreferences>(DEFAULT_SUBTITLE_PREFERENCES);
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||"null");if(data&&typeof data==="object")setPreferences({background:typeof data.background==="boolean"?data.background:true,fontSize:numberInRange(data.fontSize,14,56,26),position:numberInRange(data.position,0,100,85)});}catch{}setReady(true);},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(KEY,JSON.stringify(preferences));}catch{}},[preferences,ready]);
 return [preferences,setPreferences] as const;
}
export function SubtitleSettings({value,onChange}:{value:SubtitlePreferences;onChange:(value:SubtitlePreferences)=>void}){
 return <section aria-label="Altyazı ayarları" className="space-y-4 border-t border-white/15 p-4">
  <h2 className="font-semibold">Altyazı ayarları</h2>
  <label className="flex cursor-pointer items-center justify-between gap-3"><span>Siyah arka plan</span><input type="checkbox" checked={value.background} onChange={e=>onChange({...value,background:e.target.checked})} className="h-5 w-5 accent-brand"/></label>
  <div className="flex items-center justify-between gap-2"><span>Yazı boyutu</span><div className="flex items-center gap-2"><button aria-label="Altyazı yazısını küçült" disabled={value.fontSize<=14} onClick={()=>onChange({...value,fontSize:Math.max(14,value.fontSize-2)})} className="h-9 w-9 rounded bg-white/10 disabled:opacity-30">A−</button><output aria-label="Altyazı yazı boyutu" className="w-12 text-center tabular-nums">{value.fontSize}px</output><button aria-label="Altyazı yazısını büyüt" disabled={value.fontSize>=56} onClick={()=>onChange({...value,fontSize:Math.min(56,value.fontSize+2)})} className="h-9 w-9 rounded bg-white/10 disabled:opacity-30">A+</button></div></div>
  <div className="space-y-2"><label htmlFor="subtitle-position" className="block">Dikey konum</label><p className="text-xs text-gray-200">Siyah boşluklar dahil tüm ekran</p><input id="subtitle-position" aria-label="Altyazı dikey konumu" type="range" min={0} max={100} step={1} value={value.position} onChange={e=>onChange({...value,position:Number(e.target.value)})} className="w-full accent-brand"/><div className="flex justify-between text-sm text-gray-200"><span>Üst</span><span>Alt</span></div></div>
  <button onClick={()=>onChange({...DEFAULT_SUBTITLE_PREFERENCES})} className="text-sm text-gray-100 underline">Varsayılana dön</button>
 </section>;
}

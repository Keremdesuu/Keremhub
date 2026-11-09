"use client";
import {useState} from "react";
export function MediaArtwork({src,title="",className="",loading="lazy"}:{src:string;title?:string;className?:string;loading?:"eager"|"lazy"}){
 const [failed,setFailed]=useState<string|null>(null);
 if(failed===src)return <div className={`grid h-full w-full place-items-center bg-gradient-to-br from-ink-500 to-ink-800 p-4 text-center ${className}`}><span className="m-body text-gray-200">{title}</span></div>;
 return <img src={src} alt={title} loading={loading} decoding="async" onError={()=>setFailed(src)} className={className}/>;
}

"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import type {TitleDTO} from "@/lib/queries";
import {chooseHero} from "@/lib/discovery";
import {Hero} from "./Hero";
export function RotatingHero({candidates,scope}:{candidates:TitleDTO[];scope:string}){
 const [selected,setSelected]=useState<TitleDTO|null>(null);const path=usePathname();
 useEffect(()=>{
  const key=`keremflix.hero.last.${scope}`;
  const pick=()=>{let previous:number|null=null;try{const raw=sessionStorage.getItem(key);previous=raw?Number(raw):null;}catch{}
   const next=chooseHero(candidates,previous);setSelected(next);if(next)try{sessionStorage.setItem(key,String(next.id));}catch{}
  };
  pick();const restore=(event:PageTransitionEvent)=>{if(event.persisted)pick();};window.addEventListener("pageshow",restore);return ()=>window.removeEventListener("pageshow",restore);
 },[candidates,scope,path]);
 if(!selected)return <section aria-label="Öne çıkan içerik yükleniyor" className="-mb-20 min-h-[78vh] bg-ink-800"/>;
 return <div data-testid="rotating-hero" data-title-id={selected.id}><Hero t={selected}/></div>;
}

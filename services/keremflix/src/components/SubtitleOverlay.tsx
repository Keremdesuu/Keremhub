"use client";
import {useLayoutEffect,useRef,useState,type RefObject} from "react";
import type {SubtitlePreferences} from "./SubtitleSettings";
export function SubtitleOverlay({cues,preferences,shell}:{cues:VTTCue[];preferences:SubtitlePreferences;shell:RefObject<HTMLDivElement|null>}){
 const element=useRef<HTMLDivElement>(null);const [top,setTop]=useState<number|null>(null);
 useLayoutEffect(()=>{
  const box=element.current,container=shell.current;if(!box||!container)return;
  const measure=()=>{
   const height=container.clientHeight,half=box.getBoundingClientRect().height/2;
   setTop(Math.max(half,Math.min(height-half,height*preferences.position/100)));
  };
  const observer=new ResizeObserver(measure);observer.observe(box);observer.observe(container);measure();
  return ()=>observer.disconnect();
 },[cues,preferences.position,preferences.fontSize,shell]);
 if(!cues.length)return null;
 return <div ref={element} data-testid="subtitle-overlay" className="pointer-events-none absolute z-20 text-center text-white" style={{left:"4%",right:"4%",top:top??`${preferences.position}%`,transform:"translateY(-50%)",maxHeight:"100%",overflow:"hidden",fontSize:preferences.fontSize,fontFamily:"Arial, sans-serif",lineHeight:1.35,textShadow:preferences.background?"none":"0 1px 3px #000, 0 0 2px #000"}}>
  {cues.map((cue,i)=><div key={`${cue.startTime}:${cue.endTime}:${i}`}><span ref={node=>{if(node)node.replaceChildren(cue.getCueAsHTML());}} style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",backgroundColor:preferences.background?"rgba(0,0,0,0.85)":"transparent",padding:"2px 6px",borderRadius:2,boxDecorationBreak:"clone",WebkitBoxDecorationBreak:"clone"}} /></div>)}
 </div>;
}

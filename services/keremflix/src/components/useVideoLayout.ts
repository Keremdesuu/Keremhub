"use client";
import {useEffect,useState,type RefObject} from "react";
export interface VideoFrame {left:number;top:number;width:number;height:number}
export function fitVideoFrame(width:number,height:number,videoWidth:number,videoHeight:number):VideoFrame|null{
 if(![width,height,videoWidth,videoHeight].every(n=>Number.isFinite(n)&&n>0))return null;
 const scale=Math.min(width/videoWidth,height/videoHeight);
 const w=videoWidth*scale,h=videoHeight*scale;
 return {left:(width-w)/2,top:(height-h)/2,width:w,height:h};
}
export function useVideoLayout(video:RefObject<HTMLVideoElement|null>,shell:RefObject<HTMLDivElement|null>,mediaKey:number){
 const [frame,setFrame]=useState<VideoFrame|null>(null);
 useEffect(()=>{
  const v=video.current,container=shell.current;if(!v||!container)return;
  let raf=0;
  const measure=()=>{
   const bounds=container.getBoundingClientRect();
   const next=fitVideoFrame(bounds.width,bounds.height,v.videoWidth,v.videoHeight);
   setFrame(previous=>next&&previous&&Object.keys(next).every(key=>Math.abs(next[key as keyof VideoFrame]-previous[key as keyof VideoFrame])<0.1)?previous:next);
  };
  // Fullscreen layout may settle a frame after fullscreenchange.
  const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{measure();raf=requestAnimationFrame(measure);});};
  const observer=new ResizeObserver(schedule);observer.observe(container);
  window.addEventListener("resize",schedule);window.addEventListener("orientationchange",schedule);
  window.visualViewport?.addEventListener("resize",schedule);
  document.addEventListener("fullscreenchange",schedule);document.addEventListener("webkitfullscreenchange",schedule);
  v.addEventListener("loadedmetadata",schedule);v.addEventListener("resize",schedule);schedule();
  return ()=>{cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener("resize",schedule);window.removeEventListener("orientationchange",schedule);window.visualViewport?.removeEventListener("resize",schedule);document.removeEventListener("fullscreenchange",schedule);document.removeEventListener("webkitfullscreenchange",schedule);v.removeEventListener("loadedmetadata",schedule);v.removeEventListener("resize",schedule);};
 },[video,shell,mediaKey]);
 return frame;
}

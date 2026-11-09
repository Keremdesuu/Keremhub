"use client";
import {useEffect,useRef,useState} from "react";
import {ChevronLeftIcon,ChevronRightIcon} from "./Icons";
export function Row({title,children}:{title?:string;children:React.ReactNode}){
 const ref=useRef<HTMLDivElement>(null);const [edges,setEdges]=useState({previous:false,next:false});
 useEffect(()=>{
  const element=ref.current;if(!element)return;
  const update=()=>setEdges({previous:element.scrollLeft>2,next:element.scrollLeft+element.clientWidth<element.scrollWidth-2});
  const observer=new ResizeObserver(update);observer.observe(element);for(const child of element.children)observer.observe(child);
  element.addEventListener("scroll",update,{passive:true});update();return ()=>{observer.disconnect();element.removeEventListener("scroll",update);};
 },[children]);
 const scroll=(direction:1|-1)=>ref.current?.scrollBy({left:direction*ref.current.clientWidth*.8,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 return <section className="group/row relative" aria-label={title}>
  {title&&<h2 className="m-headline1 px-[4vw] pt-2">{title}</h2>}
  <div className="relative">
   {edges.previous&&<button onClick={()=>scroll(-1)} aria-label="Geri" className="row-arrow row-arrow--previous"><ChevronLeftIcon size={26}/></button>}
   <div ref={ref} className="row-scroller">{children}</div>
   {edges.next&&<button onClick={()=>scroll(1)} aria-label="İleri" className="row-arrow row-arrow--next"><ChevronRightIcon size={26}/></button>}
  </div>
 </section>;
}

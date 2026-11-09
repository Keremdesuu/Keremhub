"use client";
import {useId,useRef,useState,type KeyboardEvent} from "react";
import {completionOptions,insertCompletion} from "@/lib/metadata-completion";
type Props={label:string;name:string;defaultValue:string;options:string[];maxLength?:number;multiple?:boolean;className?:string};
export default function MetadataField({label,name,defaultValue,options,maxLength=200,multiple=false,className=""}:Props){
 const uid=useId(),inputId=uid+"-input",listId=uid+"-options",hintId=uid+"-hint";
 const input=useRef<HTMLInputElement>(null);
 const [value,setValue]=useState(defaultValue),[caret,setCaret]=useState(defaultValue.length),[open,setOpen]=useState(false),[active,setActive]=useState(-1);
 const matches=completionOptions(options,value,multiple,caret);
 const expanded=open&&matches.length>0;
 function choose(option:string){
  const next=insertCompletion(value,option,multiple,caret);if(next.value.length>maxLength)return;
  setValue(next.value);setCaret(next.caret);setOpen(false);setActive(-1);
  requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(next.caret,next.caret);});
 }
 function keyDown(event:KeyboardEvent<HTMLInputElement>){
  if(event.nativeEvent.isComposing)return;
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   if(!matches.length)return;
   event.preventDefault();setOpen(true);
   const next=event.key==="ArrowDown"?(active+1)%matches.length:(active<=0?matches.length-1:active-1);
   setActive(next);requestAnimationFrame(()=>document.getElementById(listId+"-"+next)?.scrollIntoView({block:"nearest"}));
  }else if(event.key==="Enter"&&expanded&&active>=0&&matches[active]){event.preventDefault();choose(matches[active]);}
  else if(event.key==="Escape"){event.preventDefault();setOpen(false);setActive(-1);}
  else if(event.key==="Tab"){setOpen(false);setActive(-1);}
 }
 return <div className={className}>
  <label htmlFor={inputId} className="block text-sm font-medium text-fg">{label}</label>
  <div className="relative mt-1.5">
   <input ref={input} id={inputId} name={name} value={value} maxLength={maxLength} autoComplete="off"
    role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId}
    aria-activedescendant={expanded&&active>=0?listId+"-"+active:undefined} aria-describedby={hintId}
    className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 pr-9 text-sm text-fg outline-none focus:border-signal focus:ring-2 focus:ring-signal/20"
    placeholder={multiple?"Tür ekleyin…":"Seçin veya yeni bir değer yazın…"}
    onFocus={()=>{setOpen(true);setActive(-1);}}
    onBlur={()=>{setOpen(false);setActive(-1);}}
    onChange={event=>{setValue(event.target.value);setCaret(event.target.selectionStart??event.target.value.length);setOpen(true);setActive(-1);}}
    onSelect={event=>setCaret(event.currentTarget.selectionStart??value.length)} onKeyDown={keyDown}/>
   <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="pointer-events-none absolute right-3 top-3 size-4 text-muted"><path d="m6 9 6 6 6-6"/></svg>
   {expanded&&<ul id={listId} role="listbox" aria-label={`${label} önerileri`} className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl">
    {matches.map((option,index)=><li key={option} id={listId+"-"+index} role="option" aria-selected={active===index}
      onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)} onMouseEnter={()=>setActive(index)}
      className={`cursor-pointer rounded-md px-3 py-2 text-sm ${active===index?"bg-signal/15 text-signal-soft":"text-fg hover:bg-signal/10"}`}>{option}</li>)}
   </ul>}
  </div>
  <p id={hintId} className="mt-1 text-xs text-muted">{multiple?"Birden çok türü virgülle ayırın; öneriden seçim diğer türleri korur.":"Mevcut kayıtlardan seçebilir veya yeni bir değer yazabilirsiniz."}</p>
 </div>;
}

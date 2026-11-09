"use client";
import {useId,useRef,useState,type KeyboardEvent} from "react";
import {completionOptions} from "@/lib/metadata-completion";
import {consumeGenreDraft,genreFormValue,genreKey,uniqueGenres} from "@/lib/genre-tags";
type Props={defaultValue:string[];options:string[];maxLength?:number;className?:string};
export default function GenreField({defaultValue,options,maxLength=1000,className=""}:Props){
 const uid=useId(),inputId=uid+"-input",listId=uid+"-options",hintId=uid+"-hint";
 const input=useRef<HTMLInputElement>(null);
 const [tags,setTags]=useState(()=>uniqueGenres(defaultValue)),[draft,setDraft]=useState(""),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[error,setError]=useState(""),[announcement,setAnnouncement]=useState("");
 const selected=new Set(tags.map(genreKey));
 const matches=completionOptions(options.filter(option=>!selected.has(genreKey(option))),draft);
 const expanded=open&&matches.length>0;
 function allowed(next:string){if(next.length>maxLength){setError(`Türler en fazla ${maxLength} karakter olabilir.`);return false;}setError("");return true;}
 function commit(value=draft){
  if(!allowed(genreFormValue(tags,value)))return;
  const additions=uniqueGenres(value.split(/[,\n]/));
  setTags(current=>uniqueGenres([...current,...additions]));setDraft("");setActive(-1);setOpen(false);
  if(additions.length)setAnnouncement(`${additions.join(", ")} türü eklendi.`);
 }
 function choose(option:string){commit(option);requestAnimationFrame(()=>input.current?.focus());}
 function change(text:string){
  if(!allowed(genreFormValue(tags,text)))return;
  const next=consumeGenreDraft(tags,text);setTags(next.tags);setDraft(next.draft);setActive(-1);setOpen(true);
  if(next.tags.length>tags.length)setAnnouncement("Tür eklendi; yeni tür yazabilirsiniz.");
 }
 function keyDown(event:KeyboardEvent<HTMLInputElement>){
  if(event.nativeEvent.isComposing)return;
  if(event.key===","||event.key==="Enter"){
   event.preventDefault();
   if(event.key==="Enter"&&expanded&&active>=0&&matches[active])choose(matches[active]);else commit();
  }else if(event.key==="Backspace"&&!draft&&tags.length){
   event.preventDefault();const last=tags[tags.length-1];setTags(tags.slice(0,-1));setDraft(last);setOpen(true);setActive(-1);setAnnouncement(`${last} düzenleniyor.`);
  }else if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   if(!matches.length)return;event.preventDefault();setOpen(true);
   const next=event.key==="ArrowDown"?(active+1)%matches.length:(active<=0?matches.length-1:active-1);setActive(next);
   requestAnimationFrame(()=>document.getElementById(listId+"-"+next)?.scrollIntoView({block:"nearest"}));
  }else if(event.key==="Escape"){event.preventDefault();setOpen(false);setActive(-1);}
  else if(event.key==="Tab"){setOpen(false);setActive(-1);}
 }
 return <div className={className}>
  <label htmlFor={inputId} className="block text-sm font-medium text-fg">Türler</label>
  <input type="hidden" name="genres" value={genreFormValue(tags,draft)}/>
  <div className="relative mt-1.5">
   <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/20">
    <div role="list" aria-label="Seçili türler" className="contents">
     {tags.map(tag=><span key={genreKey(tag)} role="listitem" className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-signal/30 bg-signal/15 py-1 pl-3 pr-1.5 text-sm text-signal-soft">
      <span className="min-w-0 break-words">{tag}</span>
      <button type="button" aria-label={`${tag} türünü kaldır`} onClick={()=>{setTags(current=>current.filter(value=>genreKey(value)!==genreKey(tag)));setError("");setAnnouncement(`${tag} türü kaldırıldı.`);input.current?.focus();}}
       className="flex size-5 shrink-0 items-center justify-center rounded-full text-signal-soft/70 hover:bg-signal/20 hover:text-fg focus-visible:outline-2 focus-visible:outline-signal">
       <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18"/></svg>
      </button>
     </span>)}
    </div>
    <input ref={input} id={inputId} value={draft} autoComplete="off" maxLength={maxLength}
     role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-describedby={hintId} aria-invalid={Boolean(error)}
     aria-activedescendant={expanded&&active>=0?listId+"-"+active:undefined}
     className="min-w-32 flex-1 basis-32 bg-transparent py-1 text-sm text-fg outline-none placeholder:text-muted"
     placeholder={tags.length?"Yeni tür…":"Tür yazıp virgüle basın…"}
     onFocus={()=>{setOpen(true);setActive(-1);}} onBlur={()=>commit()} onChange={event=>change(event.target.value)} onKeyDown={keyDown}/>
   </div>
   {expanded&&<ul id={listId} role="listbox" aria-label="Tür önerileri" className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl">
    {matches.map((option,index)=><li key={option} id={listId+"-"+index} role="option" aria-selected={active===index}
     onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)} onMouseEnter={()=>setActive(index)}
     className={`cursor-pointer rounded-md px-3 py-2 text-sm ${active===index?"bg-signal/15 text-signal-soft":"text-fg hover:bg-signal/10"}`}>{option}</li>)}
   </ul>}
  </div>
  <p id={hintId} className="mt-1 text-xs text-muted">Tür yazıp virgül veya Enter tuşuna basın ya da öneriden seçin. Kaldırmak için etiketin × işaretini kullanın.</p>
  <span role="status" className="sr-only">{announcement}</span>
  {error&&<p role="alert" className="mt-1 text-xs text-red-400">{error}</p>}
 </div>;
}

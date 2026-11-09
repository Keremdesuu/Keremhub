"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {withBase} from "@/lib/base";
type Movie={id:number;title:string;originalTitle?:string;year:number|null;posterUrl:string|null};
export function TitleActions({titleId,title,isMovie}:{titleId:number;title:string;isMovie:boolean}){
 const router=useRouter();const [open,setOpen]=useState(false);const [q,setQ]=useState(title);const [results,setResults]=useState<Movie[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function request(url:string,options?:RequestInit){const r=await fetch(withBase(url),options);const data=await r.json();if(!r.ok)throw new Error(data.error||"İşlem başarısız");return data;}
 async function reset(){setBusy(true);setMessage("");try{await request("/api/progress",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({titleId})});setMessage("İzlenmedi olarak işaretlendi");router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function search(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");setResults([]);try{const data=await request(`/api/metadata/${titleId}?q=${encodeURIComponent(q)}`);setResults(data.results);if(!data.results.length)setMessage("Sonuç bulunamadı");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function choose(id:number){setBusy(true);setMessage("");try{await request(`/api/metadata/${titleId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tmdbId:id})});setOpen(false);setMessage("Film bilgileri güncellendi");router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <div className="mt-4 space-y-3">
 <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={reset} className="rounded bg-white/10 px-4 py-2 disabled:opacity-50">İzlenmedi olarak işaretle</button>{isMovie&&<button onClick={()=>{setOpen(!open);setMessage("");}} className="rounded bg-white/10 px-4 py-2">Film eşleşmesini düzelt</button>}</div>
 {open&&<div className="max-w-xl rounded bg-black/90 p-4"><form onSubmit={search} className="flex gap-2"><input aria-label="Film adı" value={q} onChange={e=>setQ(e.target.value)} maxLength={200} required className="min-w-0 flex-1 rounded bg-white/10 p-2"/><button disabled={busy} className="rounded bg-brand px-4">Ara</button></form>
 <ul className="mt-3 max-h-80 overflow-auto">{results.map(m=><li key={m.id}><button disabled={busy} onClick={()=>choose(m.id)} className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-white/10 disabled:opacity-50">{m.posterUrl&&<img src={m.posterUrl} alt="" className="h-20 w-14 object-cover"/>}<span>{m.title} {m.year&&`(${m.year})`}<small className="block text-gray-300">{m.originalTitle}</small></span></button></li>)}</ul>{busy&&<p role="status">Yükleniyor…</p>}</div>}
 {message&&<p role="status">{message}</p>}</div>;
}

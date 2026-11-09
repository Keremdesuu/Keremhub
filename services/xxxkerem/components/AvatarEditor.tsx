"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BASE } from "@/lib/url";
export default function AvatarEditor({ profileId, mediaId, file, onClose }: { profileId: number; mediaId?: number; file?: File; onClose: () => void }) {
 const router=useRouter(), dialog=useRef<HTMLDialogElement>(null);
 const [src,setSrc]=useState(''),[dim,setDim]=useState({w:0,h:0});
 const [zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
 const side=280,scale=dim.w?side/Math.min(dim.w,dim.h)*zoom:1;
 const width=dim.w*scale,height=dim.h*scale;
 const clamp=(x:number,y:number,z=zoom)=>{
  const s=dim.w?side/Math.min(dim.w,dim.h)*z:1;
  const mx=Math.max(0,(dim.w*s-side)/2),my=Math.max(0,(dim.h*s-side)/2);
  return {x:Math.max(-mx,Math.min(mx,x)),y:Math.max(-my,Math.min(my,y))};
 };
 useEffect(()=>{dialog.current?.showModal();const url=file?URL.createObjectURL(file):`${BASE}/api/file/${mediaId}?original=1`;setSrc(url);return()=>{if(file)URL.revokeObjectURL(url);};},[file,mediaId]);
 async function save(){
  if(!dim.w||busy)return;setBusy(true);setError('');
  try{
   const fd=new FormData();if(file)fd.append('file',file);else fd.append('mediaId',String(mediaId));
   fd.append('x',String(Math.max(0,((width-side)/2-offset.x)/width)));fd.append('y',String(Math.max(0,((height-side)/2-offset.y)/height)));fd.append('size',String(1/zoom));
   const res=await fetch(`${BASE}/api/profiles/${profileId}/avatar`,{method:'POST',body:fd});const data=await res.json();if(!res.ok)throw new Error(data.error);
   router.refresh();onClose();
  }catch(e){setError(e instanceof Error?e.message:'Kaydedilemedi');}finally{setBusy(false);}
 }
 return <dialog ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="avatar-editor-title" className="m-auto max-h-[95dvh] max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl bg-panel p-4 text-white shadow-2xl backdrop:bg-black/80">
  <h2 id="avatar-editor-title" className="mb-2 text-lg font-bold">Profil fotoğrafını ayarla</h2>
  <p className="mb-3 text-sm text-muted">Fotoğrafı sürükleyin ve yakınlaştırarak istediğiniz bölgeyi seçin.</p>
  <div tabIndex={0} role="img" aria-label="Kırpma alanı; ok tuşlarıyla hareket ettirebilirsiniz." style={{width:side,height:side,touchAction:'none'}} className="relative mx-auto cursor-move overflow-hidden rounded-lg bg-black"
   onPointerDown={e=>{if(busy)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};}}
   onPointerMove={e=>{const d=drag.current;if(d)setOffset(clamp(d.ox+e.clientX-d.x,d.oy+e.clientY-d.y));}}
   onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
   onKeyDown={e=>{const moves:Record<string,number[]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};const m=moves[e.key];if(m&&!busy){e.preventDefault();setOffset(clamp(offset.x+m[0],offset.y+m[1]));}}}>
   {src&&<img src={src} alt="" draggable={false} onLoad={e=>{setDim({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight});setZoom(1);setOffset({x:0,y:0});}} onError={()=>setError('Fotoğraf açılamadı. Başka bir görsel seçin.')} style={{position:'absolute',maxWidth:'none',width:width||side,height:height||side,left:(side-width)/2+offset.x,top:(side-height)/2+offset.y,pointerEvents:'none'}}/>}
   <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90"/>
   <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">{Array.from({length:9},(_,i)=><span key={i} className="border border-white/15"/>)}</div>
  </div>
  <label className="mt-4 block text-sm" htmlFor="avatar-zoom">Yakınlaştırma · {zoom.toFixed(1)}×</label>
  <input id="avatar-zoom" type="range" min="1" max="4" step="0.01" value={zoom} disabled={busy||!dim.w} className="my-2 w-full" onChange={e=>{const z=Number(e.target.value);setZoom(z);setOffset(clamp(offset.x,offset.y,z));}}/>
  {error&&<p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
  <div className="mt-2 flex flex-wrap justify-end gap-2">
   <button type="button" className="btn-ghost" disabled={busy} onClick={()=>{setZoom(1);setOffset({x:0,y:0});}}>Sıfırla</button>
   <button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Vazgeç</button>
   <button type="button" className="btn-primary" disabled={busy||!dim.w} onClick={save}>{busy?'Kaydediliyor…':'Profil fotoğrafını kaydet'}</button>
  </div>
 </dialog>;
}

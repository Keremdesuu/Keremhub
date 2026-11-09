"use client";
import {useActionState,useState} from "react";
import {deleteBook} from "@/app/kitap/actions";
export default function BookDelete({id}:{id:number}){
 const [open,setOpen]=useState(false),[state,action,pending]=useActionState(deleteBook,{});
 return <div className="mt-6 rounded-lg border border-red-400/40 p-4">
 {!open?<button type="button" onClick={()=>setOpen(true)} className="text-sm font-semibold text-red-400">Kitabı sil</button>:
 <form action={action}>
 <p className="text-sm">Kitap HDD arşivinden kalıcı olarak silinecek. Kobo’ya gönderildiyse bir sonraki Kobo eşitlemesinde cihazdan da kaldırılacak. Okuma geçmişi ve notları silinir. Bu işlem geri alınamaz.</p>
 <input type="hidden" name="id" value={id}/><input type="hidden" name="confirm" value="yes"/>
 <div className="mt-3 flex gap-3"><button disabled={pending} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50">{pending?"Siliniyor…":"Kalıcı olarak sil"}</button>
 <button type="button" disabled={pending} onClick={()=>setOpen(false)} className="px-4 py-2 text-sm">Vazgeç</button></div>
 {state.error&&<p role="alert" className="mt-3 text-sm text-red-400">{state.error}</p>}
 </form>}</div>;
}

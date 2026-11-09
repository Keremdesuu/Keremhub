export type Item={id:string;name:string;kind:'folder'|'file';parent:string|null;size:number;mime:string;star:number;created:string;updated:string;deleted:string|null};
export type Crumb={id:string;name:string;parent?:string|null};
export type Stats={used:number;count:number;folders:number;trash:number;total:number;free:number};
export const BASE='/drive/api';
export async function api(url:string,method='GET',body?:unknown){
 const r=await fetch(BASE+url,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw Error(data.error||'İşlem tamamlanamadı.');return data;
}
export const bytes=(n:number)=>n<1024?`${n} B`:n<1024**2?`${(n/1024).toFixed(1)} KB`:n<1024**3?`${(n/1024**2).toFixed(1)} MB`:`${(n/1024**3).toFixed(1)} GB`;
export const date=(s:string)=>new Date(s).toLocaleString('tr-TR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const extension=(i:Item)=>i.name.split('.').slice(1).pop()?.toLowerCase()||'';
export function format(i:Item){
 if(i.kind==='folder')return 'folder';const ext=extension(i);
 if(ext==='pdf'||i.mime==='application/pdf')return 'pdf';
 if(ext==='docx')return 'docx';if(ext==='xlsx')return 'xlsx';
 if(['png','jpg','jpeg','gif','webp','avif','bmp','ico'].includes(ext)||/^image\/(png|jpeg|gif|webp|avif|bmp)/.test(i.mime))return 'image';
 if(i.mime?.startsWith('video/')||['mp4','webm','ogv','mov'].includes(ext))return 'video';
 if(i.mime?.startsWith('audio/')||['mp3','wav','ogg','m4a','flac'].includes(ext))return 'audio';
 if(['txt','md','csv','tsv','json','xml','log','js','ts','tsx','jsx','css','html','py','yaml','yml','ini','sh','sql'].includes(ext)||i.mime?.startsWith('text/'))return 'text';
 return 'file';
}
export const typeLabel=(i:Item)=>i.kind==='folder'?'Klasör':({pdf:'PDF belgesi',docx:'Word belgesi',xlsx:'Excel çalışma kitabı',image:'Görsel',video:'Video',audio:'Ses dosyası',text:'Metin belgesi',file:extension(i)?`${extension(i).toUpperCase()} dosyası`:'Dosya'})[format(i) as Exclude<ReturnType<typeof format>,'folder'>]||'Dosya';

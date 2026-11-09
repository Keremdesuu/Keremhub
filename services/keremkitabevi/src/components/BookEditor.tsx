"use client";
import {useActionState} from "react";
import Link from "next/link";
import MetadataField from "./MetadataField";
import GenreField from "./GenreField";
import type {MetadataOptions} from "@/lib/metadata-options";
import {updateBookMetadata} from "@/app/kitap/actions";
type P={suggestions:MetadataOptions;id:number;title:string;author:string;series:string;seriesIndex:number|null;genres:string[];description:string;language:string;publisher:string;year:number|null;metadataLocked:boolean;coverLocked:boolean;coverVersion:number;format:string;relPath:string;sizeBytes:number;hasCover:boolean};
const input="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg focus:border-signal",label="block text-sm font-medium text-fg";
export default function BookEditor(b:P){const [state,action,pending]=useActionState(updateBookMetadata,{});
return <form action={action} encType="multipart/form-data" className="mt-7 space-y-6"><input type="hidden" name="id" value={b.id}/>
<section className="rounded-xl border border-line p-5"><h2 className="text-lg font-semibold">Kitap kapağı</h2><div className="mt-4 grid gap-5 sm:grid-cols-[9rem_1fr] sm:items-start">
<div className="aspect-[2/3] w-36 overflow-hidden rounded-lg border border-line bg-surface">{b.hasCover?<img src={`${"/keremkitabevi"}/api/books/${b.id}/cover?v=${b.coverVersion}`} alt={`${b.title} mevcut kapağı`} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center p-3 text-center text-sm text-muted">Henüz kapak yok</div>}</div>
<label className={label}>Yeni kapak yükle<input className={input+" mt-2"} type="file" name="cover" accept="image/jpeg,image/png,image/webp"/><small className="mt-1 block text-muted">JPG, PNG veya WebP; en fazla 12 MB. Yükleme sırasında Kobo için uyumlu JPEG ve site için WebP olarak hazırlanır.</small></label>
</div></section>
<section className="grid gap-5 sm:grid-cols-2">
<label className={label}>Kitap adı<input className={input} name="title" defaultValue={b.title} required maxLength={300}/></label>
<MetadataField label="Yazar" name="author" defaultValue={b.author} options={b.suggestions.authors} maxLength={200}/>
<MetadataField label="Seri" name="series" defaultValue={b.series} options={b.suggestions.series} maxLength={200}/>
<label className={label}>Seri sırası<input className={input} name="seriesIndex" type="number" step="any" defaultValue={b.seriesIndex??""}/></label>
<GenreField defaultValue={b.genres} options={b.suggestions.genres} maxLength={1000} className="sm:col-span-2"/>
<MetadataField label="Dil" name="language" defaultValue={b.language} options={b.suggestions.languages} maxLength={100}/>
<MetadataField label="Yayınevi" name="publisher" defaultValue={b.publisher} options={b.suggestions.publishers} maxLength={200}/>
<label className={label}>Yayın yılı<input className={input} name="year" type="number" min="0" max="9999" step="1" defaultValue={b.year??""}/></label>
<label className={label+" sm:col-span-2"}>Açıklama<textarea className={input+" min-h-36 resize-y"} name="description" defaultValue={b.description} maxLength={20000}/></label></section>
<p className="text-sm text-muted">Kaydettiğin kitap bilgileri ve kapak sonraki taramalarda korunur.</p>
{state.error&&<p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700">{state.error}</p>}
<div className="flex gap-3"><button className="rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-60" disabled={pending}>{pending?"Kaydediliyor…":"Değişiklikleri kaydet"}</button><Link className="rounded-lg border border-line px-5 py-2.5 text-sm" href={"/kitap/"+b.id}>Vazgeç</Link></div>
<section className="rounded-lg border border-line p-4 text-sm"><h2 className="font-semibold">Dosya bilgileri (değiştirilemez)</h2><dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-muted"><dt>Biçim</dt><dd className="text-fg">{b.format.toUpperCase()}</dd><dt>Boyut</dt><dd className="text-fg">{(b.sizeBytes/1048576).toFixed(1)} MB</dd><dt>Dosya yolu</dt><dd className="break-all text-fg">{b.relPath}</dd></dl></section></form>}
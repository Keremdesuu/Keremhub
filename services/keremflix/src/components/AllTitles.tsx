import Link from "next/link";
import {kindAll,KIND_ROUTE} from "@/lib/queries";
import type {Kind} from "@/lib/kinds";
import {TitleCard} from "./TitleCard";
import {ArrowLeftIcon} from "./Icons";
const PLURAL:Record<Kind,string>={SERIES:"Diziler",MOVIE:"Filmler",ANIME:"Animeler"};
export async function AllTitles({kind}:{kind:Kind}){
 const items=await kindAll(kind);const collator=new Intl.Collator("tr",{numeric:true,sensitivity:"base"});items.sort((a,b)=>collator.compare(a.title,b.title));
 return <div className="px-[4vw] pb-16 pt-32 lg:pt-24">
  <Link href={KIND_ROUTE[kind]} className="mb-6 inline-flex items-center gap-2 text-sm text-gray-100 hover:text-white"><ArrowLeftIcon size={20}/> {PLURAL[kind]} sayfasına dön</Link>
  <header className="mb-7 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-5"><div><h1 className="text-3xl font-bold sm:text-4xl">Tüm {PLURAL[kind]}</h1><p className="mt-2 text-sm text-gray-200">{items.length} içerik · A–Z</p></div></header>
  {items.length?<section aria-label={`Tüm ${PLURAL[kind]}`} className="catalog-grid">{items.map(t=><TitleCard key={t.id} t={t} width="100%"/>)}</section>:<p className="py-12 text-gray-200">Bu kategoride henüz içerik bulunmuyor.</p>}
 </div>;
}

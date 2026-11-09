import Link from "next/link";
import {notFound} from "next/navigation";
import BookEditor from "@/components/BookEditor";
import {getBook} from "@/lib/queries";
import {getMetadataOptions} from "@/lib/metadata-options";
export const dynamic="force-dynamic";
type Params={params:Promise<{id:string}>};
export default async function EditBookPage({params}:Params){
const {id}=await params;
const [book,suggestions]=await Promise.all([/^\d+$/.test(id)&&Number.isSafeInteger(Number(id))?getBook(Number(id)):Promise.resolve(null),getMetadataOptions()]);
if(!book)notFound();
return <main className="mx-auto max-w-3xl px-4 pt-8 sm:px-6"><Link href={"/kitap/"+book.id} className="text-sm text-muted hover:text-fg">← Kitap ayrıntılarına dön</Link>
<h1 className="mt-4 text-3xl font-bold tracking-tight">Kitap bilgilerini düzenle</h1><p className="mt-2 text-sm text-muted">Kitap künyesini ve katalog bilgilerini güncelleyin.</p>
<BookEditor key={book.id} suggestions={suggestions} id={book.id} title={book.title} author={book.author?.name??""} series={book.series?.name??""} seriesIndex={book.seriesIndex} genres={book.genres.map(g=>g.name)} description={book.description??""} language={book.language??""} publisher={book.publisher??""} year={book.year} metadataLocked={book.metadataLocked} coverLocked={book.coverLocked} hasCover={book.hasCover} coverVersion={book.updatedAt.getTime()} format={book.format} relPath={book.relPath} sizeBytes={book.sizeBytes}/></main>;
}
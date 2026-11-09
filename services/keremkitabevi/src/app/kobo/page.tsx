import Link from "next/link";
import {headers} from "next/headers";
import {db} from "@/lib/db";
import {BASE_PATH} from "@/lib/config";
import {getKoboToken} from "@/lib/kobo";
import {setBookKoboSync} from "@/app/kobo/actions";
export const dynamic="force-dynamic";
export default async function KoboSetupPage(){
 const [token,hs]=await Promise.all([getKoboToken(),headers()]);
 const host=hs.get("x-forwarded-host")||hs.get("host")||"192.168.1.240";
 const proto=hs.get("x-forwarded-proto")||"http";
 const endpoint=proto+"://"+host+BASE_PATH+"/kobo/"+token;
 const books=await db.book.findMany({where:{koboSync:true},orderBy:{title:"asc"},select:{id:true,title:true,author:{select:{name:true}},koboState:{select:{downloadedAt:true}}}});
 return <main className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
 <h1 className="text-3xl font-bold tracking-tight">Kobo Clara BW</h1>
 <p className="mt-2 text-muted">Bu sayfadan seçtiğiniz kitaplar, Kobo cihazında eşitleme yaptığınızda ev ağınız üzerinden indirilir.</p>
 <section className="mt-7 rounded-xl border border-line p-5">
 <h2 className="text-xl font-semibold">Cihazı bir kez bağlayın</h2>
 <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
 <li>Kobo’yu USB ile bilgisayara bağlayıp cihazdaki <code>.kobo/Kobo/Kobo eReader.conf</code> dosyasının yedeğini alın.</li>
 <li><code>[OneStoreServices]</code> bölümündeki <code>api_endpoint</code> satırını aşağıdaki satırla değiştirin. Bölüm veya satır yoksa ekleyin.</li>
 <li>Kobo’yu güvenle çıkarın, aynı Wi‑Fi ağına bağlayın ve cihazdaki <b>Eşitle</b> düğmesine basın.</li>
 </ol>
 <pre className="mt-4 overflow-x-auto rounded-lg bg-surface p-3 text-xs"><code>{"[OneStoreServices]\napi_endpoint="+endpoint}</code></pre>
 <p className="mt-3 text-xs text-muted">Bu yerel eşitleme Kobo mağazası ve Kobo bulut kitaplığını kullanmaz. Geri dönmek için yedek dosyayı geri yükleyin veya api_endpoint satırını <code>https://storeapi.kobo.com</code> yapın.</p>
 <p className="mt-3 text-xs text-muted">Sunucu şu anda yerel HTTP kullanıyor; bu eşitleme adresini yalnızca ev Wi‑Fi ağında kullanın ve yönlendiricide internete açık port oluşturmayın.</p>
 </section>
 <section className="mt-7">
 <h2 className="text-xl font-semibold">Kobo’ya gönderilecek kitaplar <span className="text-muted">({books.length})</span></h2>
 {books.length===0?<p className="mt-3 text-sm text-muted">Henüz kitap seçilmedi. Bir kitabın ayrıntı sayfasından “Kobo’ya ekle” düğmesine basın.</p>:
 <ul className="mt-3 divide-y divide-line rounded-xl border border-line">{books.map(b=><li key={b.id} className="flex items-center gap-3 px-4 py-3">
 <Link className="min-w-0 flex-1 truncate font-medium hover:text-signal" href={"/kitap/"+b.id}>{b.title}</Link><span className="hidden text-sm text-muted sm:block">{b.author?.name}</span>
 <span className="text-xs text-muted">{b.koboState?.downloadedAt?"Dosya aktarıldı":"Gönderim bekliyor"}</span>
 <form action={setBookKoboSync}><input type="hidden" name="id" value={b.id}/><input type="hidden" name="on" value="true"/><input type="hidden" name="returnTo" value="kobo"/><button className="text-sm text-signal">Yeniden gönder</button></form>
 <form action={setBookKoboSync}><input type="hidden" name="id" value={b.id}/><input type="hidden" name="on" value="false"/><input type="hidden" name="returnTo" value="kobo"/><button className="text-sm text-muted hover:text-fg">Listeden çıkar</button></form>
 </li>)}</ul>}
 </section>
 </main>;
}
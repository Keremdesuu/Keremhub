# Kerem Kitabevi

Keremhub'a bağlı e-kitap sitesi. HDD'deki `keremkitabevi` klasörünü tarar; kitapları yazara, seriye ve türe göre süzer; tarayıcıda okutur, indirtir.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 + SQLite · epub.js

## Kurulum (Pi'de)

```bash
# proje klasörünü Pi'ye kopyala, içine gir
bash deploy/setup.sh
```

Betik sırayla: bağımlılıkları kurar → Prisma istemcisini üretir ve veritabanını oluşturur → derler → `kerem-kitabevi` systemd servisini açar → ilk taramayı yapar.
Sonra `deploy/nginx-location.conf` içeriğini nginx'e ekle (betiğin sonunda yazıyor). Site: `http://192.168.1.240/keremkitabevi/`

Servis 127.0.0.1:3002'de çalışır; dışarıya yalnızca nginx açar.

## Ayarlar (`.env`)

| Değişken | Varsayılan | Anlamı |
| --- | --- | --- |
| `LIBRARY_DIR` | `/mnt/hdd/keremkitabevi` | Kitapların klasörü |
| `NEXT_PUBLIC_BASE_PATH` | `/keremkitabevi` | Sitenin adres öneki (değişirse yeniden derle) |
| `LIBRARY_LAYOUT` | `auto` | Klasör düzeni (aşağıda) |
| `DATABASE_URL` | `file:./data/kitabevi.db` | SQLite dosyası |

## Klasörden ne okunur?

Önce kitabın içindeki üstveri (EPUB/KEPUB: başlık, yazar, seri, seri sırası, tür, kapak, açıklama) kullanılır. Eksik kalanlar klasör ve dosya adından tamamlanır:

- `auto` → `Yazar/Seri/Kitap.epub` veya `Yazar/Kitap.epub`
- `author-series` → `Yazar/Seri/…`
- `genre-author` → `Tür/Yazar/Seri/…`
- `flat` → klasöre bakma

Dosya adında `03 - Başlık` varsa 3 seri sırası olarak alınır; `Yazar - Başlık` kalıbı yazar ve başlığa ayrılır. PDF'lerde içeride üstveri okunmaz, yalnızca klasör/dosya adı kullanılır ve kapak yerine renkli üretilmiş kapak gösterilir.

Desteklenen biçimler: `.epub`, `.kepub` / `.kepub.epub`, `.pdf`.

## Tarama

- Sitede **Kütüphaneyi tara** düğmesi, ya da `npm run scan`
- Yalnızca değişen dosyalar yeniden okunur; diskten silinenler kütüphaneden kalkar
- Yeni kitap ekleyince taramayı yeniden çalıştır

## Takip (Goodreads tarzı)

Üstteki **Takip** sekmesi `/takip` sayfasını açar.

- Ana raflar: **Okunuyor**, **Okumak istiyorum**, **Okundu**, **Yarıda bıraktım**. Bir kitap aynı anda tek ana rafta durur
- **Raflarım**: kendi açtığın raflar (Favoriler, Ödünç verdiklerim…). Bir kitap birden fazla rafta olabilir
- 1–5 yıldız puan; puanlanan kitap takipte değilse Okundu rafına girer
- Raf seçmek, puanlamak ve rafa eklemek kitabın sayfasındaki **Takip** bölümünden yapılır
- Okuyucuda kitaba başlayınca kendiliğinden Okunuyor, sonuna gelince (%98) Okundu olur; başlama ve bitirme tarihleri otomatik tutulur
- Güncellemeden sonra `npx prisma db push` çalıştır (yeni tablolar için); mevcut veriler korunur

## Okuyucu

- EPUB/KEPUB: sayfa sayfa veya kaydırmalı okuma, içindekiler, yazı boyutu, gece/sepya/gündüz teması, klavye okları, kaldığın yer otomatik kaydedilir
- PDF: tarayıcının kendi PDF görüntüleyicisi (kaldığın yer kaydedilmez)

## Geliştirme

```bash
npm install && npx prisma generate && npx prisma db push
npm run dev      # http://localhost:3002/keremkitabevi
npm run icons    # logo ve ikonları yeniden üretir
```

## Kitap silme

Kitap sayfasındaki **Kitabı sil** düğmesi, ikinci bir kalıcı silme onayından sonra HDD'deki kitabı, kapak ve Kobo dönüşüm önbelleğini kaldırır. Okuma ve takip kayıtları da silinir. İşlem geri alınamaz.

Kobo kaldırma olayı Book tablosundan bağımsız KoboDeletion tablosunda tutulur. Cihaz bir sonraki eşitlemede kaldırma bildirimini alır; eşitleme yapılmadan cihazdaki dosyanın kaldırılması beklenmez.

Dağıtım: HDD bağlandıktan sonra `bash deploy/activate-book-delete.sh`. Önceki sürüme dönmek için yalnızca `93-book-delete.conf` servis ekini kaldırıp servisi yeniden başlatın. Önceki derleme korunur; veritabanındaki yeni tablo önceki sürüme engel olmaz.

Düşük bellekli derleme: `KITABEVI_LOW_MEMORY=1 NEXT_BUILD_DIR=.next-book-delete-low NODE_OPTIONS=--max-old-space-size=384 MALLOC_ARENA_MAX=2 UV_THREADPOOL_SIZE=2 RAYON_NUM_THREADS=1 SWC_THREADS=1 npx next build --webpack`. Stil taraması yalnızca `src` ile sınırlandırılmıştır; eski derleme ve yedek klasörleri taranmaz.

Kontroller: `node scripts/delete-regression.cjs`, `node scripts/kobo-sync-regression.cjs`. Ayrı SQLite veritabanındaki uçtan uca test için sunucudaki `kitabevi-delete-integration.py` kullanılır; gerçek kitaplar silinmez.

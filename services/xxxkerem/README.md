# Medya sitesi

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Prisma (SQLite) · lucide-react ikonları

Yerel ağda çalışan video/fotoğraf arşivi. Üç sekme: **Videolar**, **Fotoğraflar**, **Profiller**.

- Bir video/fotoğrafı açınca altta **Profil ve isim ayarları** paneli çıkar: ismi değiştir, **Profili düzenle** ile
  mevcut profili seç ya da yeni profil oluştur, profilden çıkar, "bunu profil resmi yap".
- Profiller sekmesinde kişiyi seçince o kişinin tüm video ve fotoğrafları (iki ayrı sekmede) görünür.
- Videolarda üzerine gelince önizleme oynatılır; arama, sıralama (yeni / çok izlenen / A–Z), "Profilsiz" filtresi ve sayfalama var.
- Fotoğraf sayfasında ← → tuşlarıyla gezilir.

## Kurulum (Raspberry Pi)

```bash
sudo apt install -y ffmpeg          # küçük resim ve süre için gerekli
cp .env.example .env && nano .env   # MEDIA_DIR, site adı, port
npm install
npx prisma db push                  # veritabanını oluşturur
NODE_OPTIONS=--max-old-space-size=1024 npm run build
npm start                           # http://IP:3300
```

2 GB RAM'li Pi'de `build` sırasında bellek yetmezse geçici swap aç (`sudo dphys-swapfile` ile 2 GB).

## Medyayı tarama

`.env` içindeki `MEDIA_DIR` klasörü (alt klasörler dahil) taranır. Arayüzde sağ üstteki **Tara** düğmesi
ya da komut satırı: `npm run scan`. Silinen dosyalar kütüphaneden de kaldırılır; profiller ve isimler
yeni taramada korunur. Dosyalara dokunulmaz, sadece okunur.

Tarayıcıda oynayan formatlar: mp4 (H.264), webm. mkv/avi/mov bazı tarayıcılarda oynamayabilir.

## Servis olarak çalıştırma

`deploy/xxxkerem.service` dosyasını düzenleyip `/etc/systemd/system/` altına koy:

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now xxxkerem
```

## Port numarasız (nginx, alt yol) kullanım

1. `.env` → `NEXT_PUBLIC_BASE_PATH="/yol"`, ardından `npm run build` (yol build sırasında gömülür).
2. `deploy/nginx-snippet.conf` içeriğini nginx'e ekle, `sudo nginx -t && sudo systemctl reload nginx`.

## Yapı

```
app/            sayfalar ve API (/api/file Range destekli akış, /api/thumb, /api/scan, /api/profiles, /api/media)
components/     Header, kartlar, MediaSettings, ProfilePicker, ...
lib/            prisma, tarayıcı (scan.ts), sorgular
prisma/         şema (Media, Profile)
```


## Profil gizliliği ve profil resimleri

Profil sayfasındaki Gizli profil düğmesi, o profile bağlı tüm fotoğraf ve videoları ana web/mobil kütüphaneden ve genel önerilerden çıkarır. Birden fazla profile bağlı içerikte herhangi bir profil gizliyse ana listelerde gösterilmez. Profil sayfasında içerik listelenmeye devam eder. Bu seçenek bir parola veya erişim yetkisi mekanizması değildir.

Profil fotoğrafı yükle düğmesi veya bir fotoğraftaki Bunu profil resmi yap işlemi resmi `profil/` klasörüne kopyalar. Asıl dosya korunur; kayıt avatar olarak işaretlenir ve fotoğraf listelerinden çıkarılır. Resmi sıfırlamak eski avatarı arşive geri eklemez. Normal Görsel ekle düğmesi profil arşivine fotoğraf eklemeye devam eder.

Kontroller: `npx tsx scripts/test-profile-visibility.ts`, `npx tsx scripts/test-profile-api.ts` (çalışan yerel servis gerektirir), `npm run build`. Testler kendi geçici kayıtlarını temizler.

## Kalıcı medya silme
Yalnızca fotoğraf/video ayrıntılarında Sil düğmesi bulunur. Onay iptal edilirse istek gönderilmez. Onay verilirse asıl HDD/yükleme dosyası, varsa profil resmi kopyası, küçük resim ve veritabanı kaydı kaldırılır; profil resmi bağlantıları sıfırlanır. Dosya silinemediğinde hata gösterilir. Dizin dışına çıkan yollar ve sembolik bağlantılar reddedilir.
Kontrol: `npx tsx scripts/test-delete-media.ts`; canlı servis için `TEST_LIVE=1 npx tsx scripts/test-delete-media.ts`. Kontroller yalnızca kendi oluşturdukları geçici dosyaları siler.

## Profil fotoğrafını kırpma
Profil fotoğrafı yükle düğmesi kaydetmeden önce kırpma ekranını açar. Fotoğraf fareyle veya dokunarak sürüklenebilir; yakınlaştırma çubuğu 1–4 kat aralığındadır. Ok tuşlarıyla da konum değiştirilebilir. Kare alan kaydedilir, daire çizgisi yuvarlak avatar görünümünü gösterir. Vazgeç mevcut fotoğrafı değiştirmez.
Mevcut özel profil resminde Profil fotoğrafını ayarla düğmesiyle tam kaynak üzerinden yeniden seçim yapılabilir. Fotoğraf ayrıntısındaki profil resmi düğmesi de aynı düzenleyiciyi açar. Kaynak görüntü ve 768×768 kırpılmış kopya profil/ klasöründe tutulur; avatarlar arşiv listelerine eklenmez.
Kontrol: `npx tsx scripts/test-avatar-crop.ts` ve çalışan servis için `TEST_LIVE=1 npx tsx scripts/test-avatar-crop.ts`.

## Orijinal fotoğrafı döndürme
Fotoğraf ayrıntısındaki Sağa döndür ve kaydet düğmesi (R), orijinal dosyayı 90° sağa döndürerek HDD’ye kaydeder. Küçük resim ve veritabanı ölçüleri güncellenir. İşlem sürerken tekrar döndürme engellenir; hatalar ekranda gösterilir. Yakınlaştırmayı sıfırlama dosyaya kaydedilmiş yönü değiştirmez. Hareketli görseller veri kaybını önlemek için bu işlemde reddedilir.
Kontrol: `npx tsx scripts/test-persist-rotation.ts` ve `TEST_LIVE=1 npx tsx scripts/test-persist-rotation.ts`. Testler yalnızca kendi geçici fotoğrafını döndürür ve temizler.

## Profil içinde gezinme
Profil kartlarından açılan fotoğraf/video bağlantıları profileId bağlamını taşır. Fotoğrafın önceki/sonraki okları ve klavye geçişleri yalnızca aynı profile bağlı, avatar olmayan fotoğrafları kullanır; profil sınırında durur. Dönüş bağlantısı profilin fotoğraf sekmesine gider. Video önerileri profil içinden açıldığında yalnızca o profilden gelir ve bağlantılarda profil bağlamı korunur. Gizli profillerin kendi içerikleri bu kapsamda gezilebilir. Seçili profile ait olmayan medya için geçersiz bağlam 404 döndürür. Genel arşivden açılan içeriklerde genel gezinme devam eder.
Kontrol: `npx tsx scripts/test-profile-navigation.ts`; canlı servis kontrolü: `TEST_LIVE=1 npx tsx scripts/test-profile-navigation.ts`.

## Hızlı fotoğraf görüntüleme
Ayrıntı görünümü önce en fazla 1600 piksel uzun kenarlı WebP kopyasını yükler; 1,4 katın üzerinde yakınlaştırma veya tam ekran orijinali yükler. Profil kapsamındaki komşu fotoğrafların hafif kopyaları önceden alınır. Kopyalar data/previews altında kaynak dosyanın değişme zamanı ve boyutuyla sürümlenir; döndürme yeni kopyayı kullanır, silme işlemi tüm ilgili kopyaları temizler. Hareketli görseller orijinal dosyaya yönlendirilir. Orijinal görüntüler küçültülmez veya değiştirilmez.
Kontrol: `npx tsx scripts/test-photo-preview.ts`; canlı servis: `TEST_LIVE=1 npx tsx scripts/test-photo-preview.ts`.

## Fotoğraflar arasında tam ekran
Fotoğraf tam ekranı, sayfa geçişlerinde korunan html öğesine bağlıdır. Görüntüleyici tam ekran sırasında ekranı kaplar; önceki/sonraki bağlantıları ve klavye okları yeni fotoğrafta tam ekranı korur. F veya tam ekran düğmesiyle çıkılır. Fotoğraf ayrıntısından profil/başka sayfaya dönüldüğünde tam ekran kapatılır. Canlı tarayıcıda okla geçiş, klavye geçişi, F ile çıkış ve tarayıcı geri düğmesiyle profile dönüş doğrulandı.

## Güncel HDD depolama düzeni
Fotoğraflar `/mnt/hdd/xxxkerem/Fotoğraflar`, videolar `/mnt/hdd/xxxkerem/Videolar`, profil resimleri ve kırpma kaynakları `/mnt/hdd/xxxkerem/Profil` altında saklanır. .env içinde PHOTO_DIR, VIDEO_DIR, PROFILE_DIR bu yolları gösterir; eski @uploads uyumluluğu için UPLOAD_DIR fotoğraf klasörüne yönelir. Yeni normal yüklemeler veritabanında Fotoğraflar/... veya Videolar/... yollarını kullanır. Profil klasörü taranmaz; aynı dosyaları ikinci kez tarayan ayrı bir upload kökü yoktur. HDD bağlı değilse yeni medya/profil dosyası oluşturulmaz.
Eski aktif SD dosyaları hash doğrulaması, kayıt kontrolü ve canlı erişim testlerinden sonra taşındı. Geri dönüş yedeği HDD üzerindeki `.backups/storage-migration-20261107-020852` içindedir. Profil gizliliği ve içerik ilişkileri korundu.
Kontrol: `npx tsx scripts/test-hdd-storage.ts` (geçici fotoğraf/video ve avatar yükler, HDD yollarını ve gizliliği kontrol eder, tam taramada kopya oluşmadığını doğrular ve test verisini temizler).

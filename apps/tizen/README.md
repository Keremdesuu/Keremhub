# Keremflix 2.1.0 — Samsung Tizen

2.0.7: Oynatıcıda Sağ/Sol tuşları iki kontrol grubundaki düğmeleri sırasıyla dolaşır; Sesi kapat düğmesinden sağa geçiş artık ilerleme çubuğuna sapmaz. Yukarı ilerleme çubuğuna çıkar, Aşağı son seçilen düğmeye döner. İlk açılıştaki gecikmeli odak işlemi kullanıcının seçimini geri almaz. Film/dizi regresyonları dahil 26 arayüz ve 7 temel test geçti. Gerçek monitörde sekiz düğme boyunca sağ/sol geçişler ve yukarı/aşağı dönüş doğrulandı; 2.0.7 imzalanıp kuruldu.

Netflix referanslarından uyarlanan, kumanda için tasarlanmış kişisel medya uygulaması. Film, dizi ve anime kitaplığı Raspberry Pi'deki mevcut Keremflix sisteminden gelir.

**Güncel sürüm: 2.1.0.** Logo siyah/kırmızı Bebas Neue olarak korunur; diğer metinler Inter kullanır. Kullanıcının verdiği 28 Regular / Medium / Bold stili, boyut ve harf aralığıyla [tipografi ölçeğinde](src/typography.json) tanımlıdır; [semantik eşlemeler](src/typography.css) ekranlara uygulanır. Gerçek 400 / 500 / 700 ağırlıkları ve Türkçe/Latin Extended fontları WGT içine gömülüdür. Lisanslar [Bebas Neue](app/fonts/OFL.txt) ve [Inter](app/fonts/Inter-OFL.txt) için korunur.

## 2.0.6 altyazı güncellemesi

Hız kontrolünün solundaki Ses ve altyazı menüsü gömülü altyazı parçalarını ve görünüm ayarlarını içerir. Boyut 22–64 px arasında değiştirilebilir; siyah arka plan açılıp kapatılabilir. Dikey konum tüm 1080 px oynatıcı alanını kapsar; Üst boşluk / Orta / Alt boşluk kısayolları ve adım düğmeleri vardır. Kontroller açıldığında altyazı konumu değişmez. Ayarlar uygulamanın localStorage alanında korunur. Varsayılana dön yalnızca altyazı boyutunu, arka planını, konumunu ve gecikmesini sıfırlar.

Bu monitör, örnek MP4 dosyasındaki mov_text parçalarını listelese de metin callback'lerini göndermedi. [Pi altyazı servisi](server/subtitles.cjs), ffprobe ile metin parçalarını listeler ve seçilen parçayı ffmpeg ile WebVTT'ye dönüştürür. Video yeniden kodlanmaz. İlk seçimde hazırlık süresi olabilir; sonuçlar bellekte önbelleğe alınır. İşlemler sırayla yürütülür, zaman ve çıktı sınırları vardır. SRT/SubRip, ASS/SSA, mov_text ve WebVTT metin parçaları desteklenir; bitmap altyazılar bu dönüştürücünün kapsamında değildir. Pi'de ffprobe/ffmpeg gereklidir. Altyazı seçimi oynatmayı kesmez; seçim değiştiğinde geç gelen eski istekler yok sayılır. Gecikme ayarı harici ve dönüştürülen gömülü metinlere uygulanır.

7 temel test ve 24 arayüz testi geçti. Gerçek monitörde gömülü MP4 altyazısı gösterildi; iki satır 42 px altyazı üstte 17.6–133.6 px, altta 946.4–1062.4 px aralığına yerleştirildi. Kaynak video 1920×800, letterbox boşlukları 140 px olduğundan iki konum da siyah boşluklarda kaldı. Menü kapatılınca konum değişmedi; sıfırlama ve kapatma doğrulandı. Kullanıcının ilerleme kaydı ve ayarları testten sonra geri yüklendi. [Sürüm raporu](dist/Keremflix-2.0.6-test-report.md).

2.0.5 sürümünde dış odak çerçeveleri kaldırıldı. [Etkileşim stilleri](src/interactions.css) seçili düğmeleri kırmızı dolgu, 110 ms hafif yükselme ve basılma efektiyle gösterir. Menüde alt çizgi; kartlarda kırmızı vurgu ve oynat simgesi kullanılır. Kartlar TV'de büyütülmez. Monitöre kurulum ve başlatma, cihazda odak stilleri ve 28 yön komutu doğrulandı (ortalama komut işleme 3.39 ms; sabit kare hızı garantisi değildir). 6 temel test ve 21 arayüz testi geçti.

İlk sıradan yukarı dönüşte içerik → büyük görselin İzle düğmesi → üst menü sırası kullanılır. Büyük görsele veya menüye geçiş sayfayı tam sıfıra alır; en üst menüde tekrar Yukarı odağı logoya sıçratmaz. Kaydırma yalnızca ilgili liste/kaydırma alanına uygulanır; dış uygulama katmanlarını kaydıran scrollIntoView kaldırılmıştır. Kaydırılmış durumda üst menünün arka planı opaktır.

Yeni simge [keremflix-icon.png](app/keremflix-icon.png) dosyasındadır. `npm run icon` komutu paketle gelen gerçek Bebas Neue dosyasını kullanarak siyah/kırmızı 512×512 simgeyi yeniden üretir. Manifestte yeni dosya adı kullanılır. Derleme, font dosyalarını ve @font-face kurallarını otomatik olarak uygulamaya kopyalar.

2.0.4 imzalandı, monitöre yüklendi ve başlatıldı. Gerçek monitörde 7 kez Aşağı ve 12 kez Yukarı ile tam başa dönüş doğrulandı. Inter 400 / 500 / 700 Türkçe font kontrolleri başarılı; logo Bebas Neue olarak doğrulandı. 6 temel/proxy testi ve 21 arayüz senaryosu geçti. [Sürüm test raporu](dist/Keremflix-2.0.4-test-report.md).

**Durum:** 2.0.1 Samsung sertifikasıyla imzalandı ve monitöre yüklendi. Bu düzeltmede sarma/donma sorunu gerçek monitörde CDP üzerinden yeniden üretildi ve giderildi. Aynı MP4 dosyasının eski aktarıcıda `PLAYER_ERROR_SEEK_FAILED` vermesi, mevcut Keremflix/nginx yolunda sarılabilmesi gözlendi. TV aktarıcısının HTTP medya başlıkları standart yazımla iletilince sarma başarılı oldu.

Gerçek AVPlay üzerinde 120. saniyeden başlatma, duraklatma, ileri/geri sarma, tekrar oynatma, altyazıyı kapatma, 2×/1× hız, ekran doldurma/sığdırma, ses kapatma/açma, konumu kaydetme ve kayıtlı konumdan yeniden başlatma doğrulandı. Sarma asenkron tamamlanmadan başka AVPlay komutu gönderilmez; başarısız bir sarma hedefi ilerleme olarak kaydedilmez. Cihaz dosyanın anahtar karelerine yuvarlayabildiğinden hedef konumda birkaç saniyelik fark olabilir.

**Yerel ağ önizlemesi:** <http://192.168.1.240:3210>

## 2.0.2 gezinme performansı

Monitörde yukarı/aşağı takılmasını azaltmak için kartlar arasında satır bazlı odak geçişi eklendi. Her tuşta bütün sayfanın geometrisini ölçmek yerine yalnızca seçilen kart ve kaydırma alanı ölçülür. Kaydırma yalnızca kart görünür sınırların dışına çıkarsa yapılır; kumanda geçişinde biriken smooth-scroll animasyonları kaldırıldı. TV'de çift büyütme, ağır kart gölgeleri ve arka plan bulanıklığı hafifletildi. Yakındaki afişler boşta kalınan sürede tek tek decode edilir; saat güncellemesi bütün kitaplığı yeniden render etmez. Başlık altında odak kaybolmasını önlemek için kaydırma payı eklendi.

Gerçek monitörde 28 yön komutluk ölçümde ortalama komut işleme süresi 17.31 ms → 2.98 ms, ortalama kare aralığı 40.61 ms → 20.31 ms oldu. Bu belirli bir tuş dizisinin ölçümüdür; bütün koşullarda sabit 60 FPS garantisi değildir. İlk afiş çizimleri sırasında gecikmeler hâlâ oluşabilir. [Performans raporu](dist/Keremflix-2.0.2-test-report.md).

## Tasarım

- Tam ekran kapak görseli, koyu geçişler, büyük başlık ve belirgin İzle / Daha fazla bilgi düğmeleri.
- Yatay içerik sıraları, ilerleme şeritleri, yeni etiketleri ve gerçek puanlara göre Top 10 sırası.
- Film / dizi / anime kategorileri, tür filtreleri, bütün kitaplık ve sıralama.
- Açılır ayrıntı ekranı: oyuncular, türler, açıklama, sezonlar, bölümler, benzer yapımlar.
- Ortak Listem ve monitörde saklanan kişisel beğeniler.
- Türkçe ekran klavyesiyle arama; yükleniyor, boş sonuç ve bağlantı hatası ekranları.
- Sunucu, otomatik bölüm devamı ve altyazı tercihleri için ayarlar.
- 1920×1080 tasarım alanı ekran boyutuna ölçeklenir; 1280×720'de de kontrol sınırları test edildi.

Referans görseller tasarım yönlendirmesi olarak kullanıldı. Ürün içinde Keremflix markası ve kullanıcının gerçek kitaplık görselleri kullanılır. Kalite veya HDR etiketleri dosyada olmayan özellikleri vaat etmez.

## Oynatıcı

Samsung monitörde AVPlay, tarayıcı önizlemesinde HTML5 video kullanılır.

- Oynat / duraklat, 10 saniye ileri / geri, kumanda medya tuşları.
- Kumandayla veya işaretçiyle kullanılabilen zaman çizelgesi, geçen/kalan süre.
- Kaldığın yerden devam, baştan başlatma, düzenli ilerleme kaydı.
- Ses parçası, dahili/harici altyazı, altyazıyı kapatma.
- Harici altyazılar için boyut, arka plan ve ±0.5 saniye gecikme ayarı.
- Ses açma/kapatma ve TV ses API'si destekliyorsa ses seviyesi.
- Bölüm menüsü, sonraki bölüm, açılıp kapatılabilen 10 saniyelik otomatik devam sayacı.
- AVPlay'in dosya için kabul ettiği 1× / 2× / 4× hızlar; HTML5'te ek ara hızlar.
- Ekrana sığdırma / doldurma; kontrolleri otomatik gizleme; arka planda duraklatma.
- Tamponlama göstergesi, hazırlama zaman aşımı, hata ve tekrar deneme ekranı.
- Aktif oynatımda ekran koruyucuyu kapatma, duraklatma/çıkışta geri açma.

Tek orijinal video dosyası sunulur; sunucuda yeniden kodlama veya birden çok çözünürlük akışı üretilmez. Ses, altyazı, hız ve codec desteği dosyaya ve monitöre bağlıdır. Yüksek hızlarda ses kesilebilir. Gecikme ayarı harici altyazılara uygulanır.

## Teknoloji

| Katman | Teknoloji |
| --- | --- |
| Arayüz | React 19, TypeScript 7 |
| Derleme | esbuild; Chrome 79 hedefi; tek yerel IIFE paketi |
| Görünüm | Yerel CSS, SVG ikonlar, uzamsal kumanda odağı |
| Video | Samsung AVPlay / HTML5 adaptörü |
| Pi servisi | Node.js yerleşik HTTP proxy, Python salt okunur SQLite katalog |
| Doğrulama | TypeScript, Node test runner, Playwright |
| Dağıtım | Samsung imzalı WGT, resmi Tizen CLI ve SDB |

React çalışma zamanı WGT içinde paketlenir; monitör CDN'den JavaScript indirmez. Pi servisinde ek npm bağımlılığı gerekmez. Büyük TV arayüzü için ağır bir CSS/framework çalışma zamanı eklenmedi.

## Geliştirme

```powershell
npm ci
npm run build
npm test
npm run test:ui
npm run preview
```

İlk Playwright kurulumunda `npx playwright install chromium` gerekir. Yerel önizleme `http://127.0.0.1:3211` adresinde açılır ve Pi'deki mevcut API'leri kullanır. Arayüz testleri API/video yanıtlarını izole eder; kullanıcının liste veya izleme geçmişini değiştirmez.

Kaynaklar: [ana ekranlar](src/main.tsx), [oynatıcı arayüzü](src/Player.tsx), [video adaptörü](src/engine.ts), [tasarım](src/styles.css), [API](src/api.ts), [kumanda ve altyazı yardımcıları](src/lib.ts).

`npm run build` önce TypeScript kontrolünü yapar; ardından [app/](app/) içine dağıtıma hazır JavaScript ve CSS üretir. Kaynak değişikliklerini monitöre uygulamadan önce derlemek gerekir. [Dağıtım scripti](scripts/deploy-monitor.ps1) bunu otomatik yapar.

## İmzalama ve yükleme

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package.ps1 -CertificateProfile KeremflixSamsung
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-monitor.ps1
```

İmzalı paket: [Keremflix-2.0.7.wgt](dist/Keremflix-2.0.7.wgt). Kaynak arşivi: [Keremflix-2.0.7-source.zip](dist/Keremflix-2.0.7-source.zip).

Dağıtım scripti bağlantı, derleme, imzalama, kurulum izni, dosya aktarımı, kurulum ve başlatma adımlarını çalıştırır. Sadece `Keremflix1.Keremflix` uygulamasını günceller; kaldırıp yeniden kurmaz. Cihazın `install completed` ve `successfully launched` yanıtlarını doğrular. İmza profili `KeremflixSamsung`; sertifikalar kullanıcıya ait `SamsungCertificate/KeremflixSamsung` dizinindedir. Sertifika/şifre/özel anahtarlar paketlere veya Pi'ye eklenmez.

Monitör bağlantısı `192.168.1.2:26101`, Developer Mode Host PC IP `192.168.1.4`. SDB cihazı `LS43BM700UPXUF`, Tizen 6.5 olarak bildirir. Kullanıcının başlangıçta belirttiği model kodu farklıdır; kurulumdaki kimlik SDB'den alınmıştır. Sertifikanın DUID'si bu bağlı cihazla eşleştirildi. Author ve distributor sertifikalarının geçerlilik tarihi 7 Kasım 2027'dir.

Resmi [Samsung sertifika rehberi](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html), [AVPlay API](https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html).

## Pi

Servis: `keremflix-tv.service`. Dizin: `/home/kerempi/keremflix-tizen`. Port: 3210. Otomatik açılış etkindir. Mevcut Next.js Keremflix API'si `127.0.0.1:3200/keremflix` üzerinde çalışmaya devam eder. Tam katalog ve Listem okunurken mevcut SQLite veritabanına salt okunur bağlantı açılır; liste ve ilerleme yazıları mevcut Keremflix API'lerine gider.

```sh
systemctl status keremflix-tv.service
journalctl -u keremflix-tv.service -n 60 --no-pager
```

Önceki Pi istemci/servis dosyaları `/home/kerempi/keremflix-tizen/backups/keremflix-before-v2.tar.gz` arşivine yedeklendi. Ana Keremflix kaynakları, şeması, medya dosyaları ve diğer uygulamalar değiştirilmedi.

## Test sonucu

6 temel test + 18 arayüz/oynatıcı senaryosu geçti. Ham HTTP başlıklarının yazımı, gecikmeli/asenkron sarma, işlem çakışması ve başarısız sarmada konum kaydı için regresyon kontrolleri eklendi. Önceki görsel testlerde gerçek kitaplıkla 10 ekran görüntüsü ve tarayıcı hataları kontrol edildi. Pi kontrolünde 33 film, 12 dizi, 10 anime; katalog, arama, afiş, ayrıntı ve Range video aktarımı doğrulandı.

[Ayrıntılı test raporu](dist/Keremflix-2.0.1-test-report.md). Playwright testlerine ek olarak bu düzeltmedeki temel oynatıcı komutları fiziksel monitörün gerçek AVPlay motorunda da test edildi. Bu canlı kontrol tek bir H.264/AAC MP4 dosyası üzerindedir; bütün codec/dosya çeşitlerinin testi değildir.

# Keremhub Android 2.0.5

Dört servis için native Android Java uygulaması. Servis ekranları, listeler,
formlar, galeri, video oynatıcıları ve EPUB/PDF okuyucu Android View/Canvas
bileşenleriyle çizilir. Uygulama içinde web sitesini açan WebView veya
tarayıcıya yönlendirilen servis ekranı yoktur.

## Kurulum

[Keremhub.apk](./build/Keremhub.apk) dosyasını telefonda açarak mevcut
uygulamanın üzerine yükleyin. Sürüm: 2.0.5, versionCode: 8.
İmza anahtarı korunmuştur; güncelleme için uygulama verilerini silmek gerekmez.
Android 8.0 ve üzeri desteklenir.

Telefon sunucuyla aynı ağda olmalıdır. Varsayılan sunucu
`http://192.168.1.240`; ana ekrandaki k simgesinden ayarlar açılır.
Sunucu verileri yerinde kalır; bu çalışma sunucu kaynaklarını değiştirmez.

## Tasarım ve ekranlar

xxxkerem 2.0.5: tam ekrana/PiP'ye geçişte decoder, video kaynağı ve önbellek
korunur; video yeniden açılmaz. Açılışta gereksiz sıfıra sarma kaldırıldı.
Dosya başlığı ve sarma hedefleri HTTP Range ile okunur; 256 KB parçalar ve
2 MB önbellek kullanılır. Sarma, hızlı erişim için en yakın anahtar kareye gider.
Texture ve son video karesi pencere geçişinde korunur; duraklatılmış videoda da
yeniden yükleme veya tekrar sarma yapılmaz.

Gerçek video üzerinde oynatıcı kimliği, konum, oynatma/duraklatma durumu ve
texture piksel örnekleriyle duraklatılmış görüntüyü kontrol eden test:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-gallery-player.ps1
```

Test yalnız video dosyasını okur; görüntülenme veya izleme geçmişi yazmaz.

Keremflix'te film/dizi/anime oynatımı doğrudan yatay tam ekranda başlar;
cihazın otomatik döndürmesi kapalıyken de çalışır. Bölüm geçişleri mevcut tam
ekran tercihini korur; oynatıcı kapandığında yön kilidi ve tam ekran kaldırılır.

### Keremflix 2.0.3

- Film detayında **Film eşleşmesini düzelt**: film adıyla TMDB araması,
  kapak/yıl/orijinal ad ile doğru yapımı seçme. Web ile aynı
  `GET/POST /keremflix/api/metadata/{titleId}` kullanılır; manuel eşleştirme
  sunucuda tutulur ve sonraki taramalarda sunucunun koruma kuralına tabidir.
- **İzlenmedi olarak işaretle**: `DELETE /keremflix/api/progress` ile yapımın
  ilerlemesi sıfırlanır, detay ve oynatma başlangıcı yeniden yüklenir.
- Hızın solundaki **Altyazı** menüsünde Kapalı, harici ve gömülü akışlar;
  görüntü tabanlı desteklenmeyen akışlar pasif gösterilir. Web ile aynı
  `/api/subtitles/{episodeId}?stream=…` VTT dönüşümü kullanılır.
- Siyah arka plan, 14–56 px yazı, %0–100 dikey konum ve varsayılana dönüş.
  Varsayılan: arka plan açık, 26 px, %85. Ayarlar cihazda kalıcıdır.
  Konum tüm oynatıcı alanına göre hesaplanır; üst/alt siyah boşluklar dahildir.
- Hıza basılı tutarak ses parçası, PiP ve kısayol seçenekleri açılır.

Yeni özellik testi, gerçek sunucuya yazma iletmeden bellek içi test sunucusunda
metadata ve ilerleme isteklerini, altyazı görünümünü ve ayar kalıcılığını sınar:

```powershell
# Ayrı terminalde açık bırakın:
node .\scripts\flix-fixture-server.mjs
# APK derlendikten sonra:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-flix-features.ps1
```

Karşılaştırma ve test kapsamı: [Keremflix güncelleme kontrolü](./KEREMFLIX_UPDATE_QA.md).

Canlı site 390×844 dikey ve 844×390 yatay tarayıcı alanlarında incelenmiştir.
Yerel ekranlar aynı responsive eşiklere göre tekrar yerleşir. Keremflix'in
mobil kapak düzeni masaüstündeki katmanlı tasarımdan ayrı tutulur.

Ekran envanteri ve doğrulama kapsamı:
[Native arayüz incelemesi](./NATIVE_UI_AUDIT.md).

- Portal: servisler, düzenleme, sistem bilgileri, bağlantı ayarları.
- Keremflix: ana sayfa, üç kategori, arama, Listem, detay, sezon/bölüm,
  ekranı kaplayan native player, altyazı/ses/hız/PiP.
- XXXKerem: video/fotoğraf/profil listeleri, detaylar, inline player,
  tam ekran, fotoğraflarda geçiş ve yakınlaştırma, profil yönetimi.
- Kitabevi: kütüphane, filtre/sıralama/sayfalama, detay/düzenleme,
  takip/raflar, Kobo, yükleme ve native EPUB/KEPUB/PDF okuma.
- Drive: dosya/klasör, arama, liste/ızgara, konumlar, seçim ve işlemler,
  yükleme, çöp kutusu, depolama ve native önizleme.

Video: tek dokun kontrol şeridi; çift dokun ±10 saniye;
basılı tut geçici 2×. Fiziksel klavyeyle oynat/duraklat, ileri/geri, ses
ve tam ekran kısayolları da desteklenir.

Keremflix videoları 256 KB HTTP Range parçaları ve en fazla 2 MB uygulama
önbelleğiyle okunur; dosya sonundaki video bilgisi doğrudan istenir.
Oynatma bilgisi istekleri kapak indirme kuyruğundan bağımsızdır.
Player'daki önceki/sonraki bölüm butonları dikey ve yatay ekranda görünür;
geçişte tam ekran korunur ve geri geçmişine fazladan player eklenmez.

## Derleme

Kaynak deposuna derleme çıktıları ve imza anahtarı eklenmez. İlk derlemede
yerel bir geliştirme anahtarı oluşturulur. Mevcut telefondaki uygulamanın üzerine
güncelleme yüklemek için önceki imza anahtarını yerel `signing/` klasöründe
kullanmak gerekir.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

JDK, Android SDK platformu ve build-tools/36.0.0 gerekir.
APK hizalanır, mevcut geliştirme anahtarıyla imzalanır, imzası doğrulanır.

## Doğrulama

```powershell
node .\scripts\check-server.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-native.ps1 -Install -Orientation portrait
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-native.ps1 -Orientation landscape
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-player-source.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-flix-player.ps1
```

24 salt-okunur sunucu kontrolü geçti. Android emülatöründe soğuk açılış,
dört servis girişi, native görünüm ağacı, dikey/yatay yerleşim ve çökme
günlüğü kontrol edildi. İlave detay/player/fotoğraf/EPUB testleri envanterde
belirtilmiştir. Test ekran görüntüleri derleme çıktısında tutulur.

Player veri kaynağı testi gerçek yerel HTTP sunucusuyla parça okuma,
önbellek sınırı, 2 GB üzeri dosyada sona atlama, EOF, kapatma ve bozuk
sunucu yanıtlarını kontrol eder. Player emülatör testi gerçek videoda ilk
kareyi bekler; izleme ilerlemesini normal oynatıcı gibi sunucuya kaydeder.

## Sınırlar

- Yerel EPUB metin, görsel, bağlantı ve içindekiler okuyucusudur.
  Tarayıcı CSS/SVG düzeninin tümünü taklit etmez; SVG içindeki raster
  kapaklar desteklenir. Yerel metin ofsetleri ile web EPUB CFI konumları
  aynı koordinat sistemi değildir.
- Office önizlemesi okuma görünümüdür; tam Word sayfalaması ve Excel
  grafik/karmaşık nesneleri garanti edilmez.
- Video codec, gömülü ses/altyazı ve PiP desteği cihazın Android
  uygulamasına bağlıdır.
- Yükleme/silme/metadata/Kobo gibi gerçek veriyi değiştiren işlemler,
  tasarım kontrolü sırasında kullanıcı arşivi üzerinde çalıştırılmadı.
- Native sistem dosya seçicisi, paylaşım penceresi ve bazı diyaloglar
  web sayfasıyla aynı piksel düzenini kullanmaz. Tüm cihaz ve durumlar
  için piksel-piksel eşitlik doğrulandığı iddia edilmez.

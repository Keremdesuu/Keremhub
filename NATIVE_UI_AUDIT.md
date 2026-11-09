# Native arayüz envanteri — 8 Kasım 2026

## Yöntem

Canlı site 390×844 dikey ve 844×390 yatay alanlarda açıldı; yerel
`inspection/` kaynaklarıyla rota, responsive eşik ve bileşen düzenleri
karşılaştırıldı. Aynı veri türündeki tüm kitaplar/filmler ayrı tasarım
sayılmaz: aşağıda dinamik rota şablonları listelenir.

Android kontrolleri mevcut API 37 emülatöründe yapıldı. `native` sütunu
gerçek çalışma zamanı kontrolünü belirtir; kaynak incelemesiyle aynı şey
değildir. Derleme ve APK imza kontrolü ayrıca yapılır. Ekran görüntüleri
`build/native-qa/` altında, tekrar çalıştırılabilir kontrol
`scripts/smoke-native.ps1` içindedir.

## Site sayfaları

| Servis / rota | Dikey + yatay site | Native uygulama kontrolü |
|---|---|---|
| Portal `/` | İncelendi | Soğuk açılış ve dört servis; iki yön |
| Portal düzenleme / sistem | Bileşen kaynakları | Native formlar ve sistem sayfası mevcut; yazma testi yok |
| Flix `/keremflix` | İncelendi | İki yön, kapak/raflar |
| Flix `/dizi`, `/film`, `/anime` | Üçü ayrı açıldı | Native ortak kategori yerleşimi, responsive grid |
| Flix `/arama?q=…` | İki yön açıldı | Native arama ve filtre uygulaması |
| Flix `/listem` | İki yön açıldı | Native kart/grid uygulaması |
| Flix `/title/[id]` | Film ve dizi şablonları incelendi | Native detay, sezon ve bölüm seçimi |
| Flix `/watch/[id]` | Player ve kontroller incelendi | Gerçek video oynadı; dikey, yatay tam ekran, duraklatma ve geri |
| Galeri `/xxxkerem` | İncelendi | Dikey/yatay native video listesi |
| Galeri `/photos` | İncelendi | Dikey/yatay native fotoğraf gridleri |
| Galeri `/profiles` | İncelendi | Native responsive profil grid ve arama |
| Galeri `/profiles/[id]` | İncelendi | Native detay, video/fotoğraf sekmeleri ve yönetim formları |
| Galeri `/watch/[id]` | İncelendi | Inline native player, dikey/yatay, tam ekran ve geri |
| Galeri `/photo/[id]` | İncelendi | Gerçek sonraki fotoğraf geçişi; iki yönde yerleşim |
| Kitabevi `/keremkitabevi` | İncelendi | İki yönde native ana sayfa |
| Kitabevi `/kutuphane` | İncelendi | 432 kitap API sonucu, kartlar/filtreler/sayfalama |
| Kitabevi `/kitap/[id]` | İncelendi | Native kitap ayrıntısı ve okuyucu girişi |
| Kitabevi `/kitap/[id]/duzenle` | İki yön salt-okunur açıldı | Native metadata/kapak formu; kaydetme çalıştırılmadı |
| Kitabevi `/takip` | İki yön açıldı | Native takip, puanlar, raflar |
| Kitabevi `/kobo` | İki yön açıldı | Native yönerge ve gönderim listesi; cihaz eşitlemesi çalıştırılmadı |
| Kitabevi `/oku/[id]` | İki yön açıldı | EPUB metni ve SVG içindeki raster kapak native açıldı; iki yön kontrol edildi |
| Drive `/drive/` | İki yön açıldı | İki yön native dosya alanı |
| Drive klasör / breadcrumb | Canlı mevcut klasör açıldı | Native klasör gezinmesi ve üst dizin |
| Drive liste / ızgara / arama | Kaynak ve canlı kontroller | Responsive native sütunlar ve filtreleme |
| Drive çöp kutusu | İki yön açıldı | Native boş/hata/liste durumları; silme testi yok |
| Drive PDF önizleme | Mevcut PDF iki yönde açıldı | Native PDF okuyucu uygulanmış |
| Drive yıldızlı / son kullanılan | API + kaynak | Native konum menüsü; boş durumlar |

## Form ve durum kapsamı

- Portal ekle/düzenle, sıralama ve kısayol kaldırma onayı.
- Kitabevi arama/filtre, yükleme/tarama, metadata/kapak düzenleme,
  okuma durumu, puan, raf ve Kobo işlemleri.
- Galeri başlık/profil düzenleme, yeni profil, fotoğraf kırpma,
  yükleme/tarama ve silme onayları.
- Drive yeni klasör, ad değiştirme, seçim, taşıma/kopyalama, yükleme,
  önizleme, yıldız, çöp/geri yükleme ve kalıcı silme onayları.
- Boş liste, yükleniyor ve bağlantı/codec hataları native görünümlerdir.

Bu formların kaynakları ve native karşılıkları incelendi. Kullanıcı
arşivini değiştiren son onaylar test amacıyla gönderilmedi.

## Doğrulanan teknik düzeltmeler

- 2.0.2: Keremflix oynatma bilgisi kapak indirme kuyruğundan ayrıldı.
  Native video kaynağı 256 KB HTTP Range okumaları ve 2 MB sınırlı
  önbellekle çalışır; dosyanın sonundaki metadata doğrudan okunur.
  Sıfır başlangıç konumuna gereksiz seek kaldırıldı.
- 2.0.2: Player'a dikey/yatay ekranlarda önceki ve sonraki bölüm
  butonları eklendi. Sınırdaki buton pasiftir; geçiş tam ekranı korur,
  detay sayfasını yeniden açmaz ve geri geçmişini şişirmez.
  API'nin sezon/bölüm sırasıyla sezonlar arasında da geçiş yapılır.
- 2.0.2 kontrolü: API 37 emülatöründe Lucifer 1. bölüm ilk karesi
  2,3 saniyede, sonraki bölüm 1,3 saniyede, önceki bölüme dönüş
  2,0 saniyede gösterildi. Bunlar bu sunucu/ağ/emülatör ölçümleridir;
  önceki sürümle kontrollü hız karşılaştırması yapılmadı.
  `scripts/smoke-flix-player.ps1` gerçek kare, bölüm değişimi,
  dikey/yatay kontroller, tam ekran ve geri geçmişini kontrol eder.
  `scripts/test-player-source.ps1` önbellek/Range sözleşmesini,
  2 GB üstü rastgele okumayı ve hatalı sunucu yanıtlarını doğrular.

- 2.0.1: Keremflix'in ortak başlığına dikeyde ev ikonu, yatayda ikon ve
  Keremhub etiketi taşıyan doğrudan native hub düğmesi eklendi. Player'ın
  üst şeridinde de hub düğmesi bulunur; dönüş gezinme geçmişini temizler.
- 2.0.1: Uygulama simgesi ve portal markası yeni vektör K monogramıyla
  değiştirildi. Android adaptive ve tek renk tema simgeleri eklendi.
  Düzenlenebilir kaynak: `branding/keremhub.svg`.

- Uzak siteyi gömen sınıf ve EPUB WebView sınıfı kaldırıldı.
- Çift üst görünüme eklenen Android gövdesi kaynaklı çökme yolu kaldırıldı.
- Player standart MediaController yerine native katman/vektör ikonlarla yeniden yazıldı.
- Kitaplık tüm API sayfalarını toplayıp yinelenen/eksik sonuçları kontrol eder.
- Galeri fotoğraf komşuları, ekrana eklenmemiş gizli görünümden bağımsız yüklenir.
- Native EPUB, SVG sarmalayıcı içindeki JPEG/PNG kapaklarını ayrıştırır;
  yalnız görsel içeren bölümleri FIT_CENTER ImageView ile gösterir.
  843 numaralı EPUB'un daha önce boş kalan 2/56 arka kapağı son APK'da
  hem dikey hem yatay ekran görüntüsüyle doğrulandı. Desteklenmeyen boş
  bölümde açıklama gösterilir.
- Ayrı site WebView'i veya tarayıcı servis yönlendirmesi yoktur.

## Açık sınırlar

Tam web CSS dizgisi native EPUB ile aynı değildir. Office önizlemesi tam
Office motoru değildir. Sistem dosya/paylaşım pencereleri Android'e aittir.
Her veri, menü durumu ve cihazda otomatik piksel fark testi yapılmadı;
bu envanter piksel-piksel eşitlik garantisi değildir.

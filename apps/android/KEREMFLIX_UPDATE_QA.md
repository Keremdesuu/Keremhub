# Keremflix 2.0.3 — 8 Kasım 2026

## 2.0.4 — otomatik yatay tam ekran

Keremflix'te yeni film/dizi/anime oynatımı yatay tam ekran başlar. Bölüm
geçişinde mevcut tam ekran tercihi korunur. Güncellenen emülatör testi,
otomatik döndürme kapalıyken yatay ölçüleri ve tam ekran bayrağını; oynatıcıdan
ayrılınca yön isteğinin serbest bırakılmasını ve sistem çubuklarının geri
gelmesini kontrol eder. Yeni görüntü: `automatic-landscape.png`.

Canlı referans: `http://192.168.1.240/keremflix`.
Değişiklikler native Java ekranlarına uygulandı; sunucu kaynakları değiştirilmedi.

| Akış | Web karşılaştırması | Android doğrulaması |
|---|---|---|
| Film detay işlemleri | Oynat/Listem altında %10 beyaz arka planlı, sarılan işlem butonları | Detay ekranı ve ekran görüntüsü |
| Film arama | Satır içinde film adı/Ara; siyah panel; kapak, ad, yıl, orijinal ad; en çok 320 px sonuç alanı | Arama, seçim ve güncel başlıkla yeniden yükleme |
| İzlenmedi | `DELETE /api/progress`, JSON `titleId` | Kesin yöntem/gövde kontrolü; Devam Et → Oynat |
| Gömülü altyazılar | Hızın solunda menü; Kapalı ve etiketli akışlar; desteklenmeyenler pasif | Destekli/pasif akış, seçim, kapatma ve hata durumu |
| Ayarlar | Siyah arka plan onayı, A− / değer / A+, dikey sürgü, Üst/Alt ve sıfırlama | Kalıcı kayıt, oynatıcı yeniden açılışı ve varsayılana dönüş |
| Siyah boşluklarda konum | Web kaynağında player shell yüksekliği üzerinden %0–100; satır yüksekliğiyle kenarda sınırlama | İki satırlı altyazıyla dikey/yatay, üst/alt uç ekran görüntüleri |

Web istemcisinin güncel yayınlanan bileşenleri okundu: `TitleActions`, `Player`,
altyazı tercihleri ve overlay. Web'de varsayılanlar arka plan açık, 26 px, %85;
boyut sınırları 14–56 px. Mobilde aynı değerler ve görünüm sırası kullanıldı.
Canlı `/api/subtitles/10514` Türkçe/İngilizce akışları listeliyor; Türkçe akışın
VTT dönüşümü HTTP 200 ve 825 zaman aralığıyla doğrulandı.

## Çalıştırılan kontroller

- APK derleme ve mevcut anahtarla imza doğrulaması.
- 24 salt okunur servis API kontrolü.
- Emülatörde portal/dört native servis açılışı.
- Ayrı imzalı instrumentation APK ile yeni özelliklerin uygulama üzerinde
  testi. Test proxy'si tüm yazmaları engeller; beklenen iki istek yalnız bellekte
  uygulanır: metadata POST `{tmdbId:12345}` ve progress DELETE `{titleId:98}`.
- Altyazı testi gerçek video akışını okur, örnek VTT ve hata yanıtı kullanır;
  oynatıcıya boş progress yolu verildiği için ilerleme yazmaz.
- Ekran görüntüleri: `build/flix-feature-test/screenshots/flix-feature-qa/`.

## Doğrulama sınırı

Gerçek film metadata'sı ve izleme geçmişi testte değiştirilmedi. Yeniden tarama
sonrasında eşleştirmenin korunması sunucunun mevcut manuel eşleştirme davranışıdır;
mobil aynı endpoint'e kaydeder. Gerçek arşiv üzerinde yeniden tarama testi yapılmadı.
Android'in sistem çubukları, yazı rasterleştirmesi ve native kaydırma bileşenleri
nedeniyle tüm cihazlarda piksel eşitliği iddia edilmez. Yeni ekranların düzeni,
renkleri, kontrol sırası ve varsayılanları web ile karşılaştırıldı.

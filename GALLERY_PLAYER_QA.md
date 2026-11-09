# xxxkerem oynatıcı düzeltmesi — 9 Kasım 2026

Sürüm 2.0.5, versionCode 8.

## Neden ve değişiklik

Eski `GalleryPlayer.transfer()` tam ekran ve PiP geçişlerinde `prepareOpen()`
çağırıyor, `VideoView` ve `MediaPlayer` nesnelerini yeniden oluşturuyordu.
Hazırlıktan sonra başlangıç konumu sıfır olsa bile bir sarma daha yapılıyordu.

Yeni uygulama:

- xxxkerem, ortak `StreamVideoView` üzerinden 256 KB HTTP Range okumaları ve
  en fazla 2 MB önbellekle oynatır. MP4 sonundaki metadata doğrudan okunur.
- Pencere geçişlerinde aynı `MediaPlayer`, veri kaynağı, `SurfaceTexture` ve
  `Surface` korunur. Video yeniden hazırlanmaz ve oynatma konumu değiştirilmez.
- Duraklatılmış kare texture ile beraber taşınır; geçişte yeniden sarılmaz.
- Yeni oynatmada sıfıra sarma kaldırılmıştır. Sarma en yakın anahtar kareyi
  kullanır; retry için kayıtlı başlangıç konumu varsa o konuma gidilir.
- Hazırlanmış fakat henüz başlamamış `MediaPlayer` üzerinde geçersiz `pause()`
  çağrısı engellenmiştir.

## Doğrulama

`scripts/test-gallery-player.ps1`, imzalı uygulama üzerinde instrumentation
çalıştırır. Gerçek bir 280.735.723 bayt video yalnız okunur; detay/görüntülenme
veya izleme geçmişi yazma endpoint'leri çağrılmaz.

Kontroller: hazırlık, seek-complete olayıyla ileri/geri sarma, tam ekrana giriş
ve çıkışta video/decoder kimliği ve konum, oynuyor/duraklatılmış durumu,
texture'dan piksel okuyarak boş kare olmaması ve aynı duraklatılmış görüntü.

Emülatör/LAN örnek ölçümleri:

| İşlem | Önce | Sonra |
|---|---:|---:|
| Hazır hale gelme | 3.794 ms | 697 ms |
| Tam ekran giriş testi | 5.436 ms | 873 ms |
| Tam ekran çıkış testi | 6.975 ms | 605 ms |
| İleri sarma tamamlanması | Karşılaştırılabilir ölçüm yok | 323 ms |
| Geri sarma tamamlanması | Karşılaştırılabilir ölçüm yok | 383 ms |
| Tam ekranda decoder korunması | Hayır | Evet |

Tam ekran ölçümleri testin 500 ms görüntü beklemesini de içerir. Ağ ve cihaz
koşulları süreleri etkiler; tüm videolar için sabit performans garantisi değildir.
Önceki sarma ölçümü callback yerine konum getter'ını izlediğinden tabloda
karşılaştırılmamıştır.

HTTP kaynak testi; cache reuse/eviction, 2 GB üzeri dosyada sona atlama, EOF,
kapatma, eksik/hatalı range yanıtları ve gerçek dosyanın sonundan okumayı geçti.
Gerçek dosyanın son 1 KB okuması örnekte 72 ms sürdü.

APK derleme/imza doğrulaması ve ortak oynatıcı nedeniyle Keremflix özellik
regresyon testi ayrıca çalıştırılır. Sonuç dosyaları `build/gallery-player-test/`
ve `build/flix-feature-test/` altında tutulur.

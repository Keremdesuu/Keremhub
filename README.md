# Keremhub 2.1.0

## İndir

| Platform | İndirme |
|---|---|
| **Web / Raspberry Pi** | [Web ZIP paketini indir](https://github.com/Keremdesuu/Keremhub/releases/download/v2.1.0/Keremhub-Web-2.1.0.zip) |
| **Android** | [Android APK'yi indir](https://github.com/Keremdesuu/Keremhub/releases/download/v2.1.0/Keremhub-Android-2.1.0.apk) |
| **Tizen OS / Samsung** | [Tizen WGT'yi indir](https://github.com/Keremdesuu/Keremhub/releases/download/v2.1.0/Keremhub-TizenOS-2.1.0.wgt) |

[Tüm indirmeler ve sürüm notları](https://github.com/Keremdesuu/Keremhub/releases/tag/v2.1.0)

Web ZIP beş web servisini ve Raspberry'deki TV köprüsünü içerir. Android ve Tizen dosyaları imzalı kurulum paketleridir.

Android, Samsung Tizen ve Raspberry Pi üzerinde çalışan web servisleri için ortak kaynak deposu.
Ortak yayın numarası [VERSION](./VERSION) dosyasında tutulur. Android APK, Tizen WGT ve web/sunucu kodu aynı `v2.1.0` etiketi altında yayınlanabilir.

## Projeler

| Klasör | İçerik | Sunucu yolu / port |
|---|---|---|
| [apps/android](./apps/android/) | Dört servisi kapsayan native Android uygulaması | Ana sunucu URL'sine bağlanır |
| [apps/tizen](./apps/tizen/) | Samsung Keremflix istemcisi, TV köprüsü ve paketleme araçları | Köprü: `3210` |
| [services/keremhub-portal](./services/keremhub-portal/) | Ana portal ve sistem bilgileri | `/` · `3000` |
| [services/keremflix](./services/keremflix/) | Film/dizi/anime web uygulaması, mobil API, video ve altyazı | `/keremflix` · `3200` |
| [services/xxxkerem](./services/xxxkerem/) | Video, fotoğraf ve profil yönetimi | `/xxxkerem` · `3300` |
| [services/keremkitabevi](./services/keremkitabevi/) | Kitaplık, okuyucu, Kobo ve mobil API | `/keremkitabevi` · `3002` |
| [services/kerem-drive](./services/kerem-drive/) | Dosya yönetimi, yükleme ve önizleme | `/drive` · `3400` |

Nginx beş web servisini tek adres altında sunar. Android bunların API'lerini kullanır.
Samsung uygulaması TV köprüsüne bağlanır; köprü Keremflix API'sini aktarır ve katalog için mevcut Keremflix veritabanını salt okunur açar.

## Ortak sürüm

Node.js 24 veya üzeri kullanın. Kök araçların ek npm bağımlılığı yoktur.
Her uygulamanın bağımlılıkları ve kilit dosyaları ayrı korunur; tüm projeleri tek bağımlılık ağacına birleştirmeyin.

```sh
node scripts/version.mjs --check
# Yeni bir ortak sürüm hazırlamak için:
node scripts/version.mjs 2.1.1
```

Komut Android manifestini ve ayarlardaki sürümü, Tizen manifestini, altı Node projesinin paket/kilit dosyalarını ve kök sürümünü eşler.
Android `versionCode`, uygulamanın sürüm adı değiştiğinde bir kez artar. Aynı sürümü tekrar eşlemek sayacı artırmaz.
Tarihsel sürüm notları kendi belgelerinde korunur.

## Derleme

Android, Windows/JDK/Android SDK ile:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

Çıktı: `apps/android/build/Keremhub.apk`. Güncelleme imzası için eski anahtarı yerel
`apps/android/signing/` klasöründe tutun; anahtar depoya dahil edilmez.

Tizen:

```sh
npm --prefix apps/tizen ci
npm --prefix apps/tizen run check
npm --prefix apps/tizen run build
npm --prefix apps/tizen test
npm --prefix apps/tizen run package
```

WGT çıktısı `apps/tizen/dist/` altındadır. TV'ye kurulum için mevcut Samsung sertifika profiliyle imzalama gerekir;
ayrıntılar [Tizen README](./apps/tizen/README.md) dosyasındadır.

Web servisleri için ilgili klasörde `npm ci` ve `npm run build` çalıştırın.
Gerçek ayarları ilgili `.env.example` dosyasından hazırlayın. Veritabanları, medya klasörleri ve ortam ayarları bu kaynak deposunun parçası değildir.
Prisma kullanan projelerde istemcinin üretilmesi ve yeni kurulumda şemanın hazırlanması gerekir; servis README'lerini izleyin.

## Raspberry kurulumu

Her servisin `deploy/` klasöründe Linux servis/Nginx şablonları bulunur. Bazı eski şablonlar `/home/kerempi/...` kurulum yollarını içerir.
Mevcut Raspberry'yi güncellerken kaynakları mevcut uygulama dizinlerine eşleyin veya servis çalışma dizinlerini yeni repo yollarına uyarlayın.
Üretimdeki `.env`, veritabanı ve medya klasörlerini kaynak kodla değiştirmeyin. TV köprüsünün `KEREMFLIX_DB` ayarı mevcut Keremflix veritabanını göstermelidir.
Bu depo aktarımı çalışan Raspberry servislerini değiştirmez veya yeniden başlatmaz.

## Kontroller ve yayın

```sh
npm run check
npm run test:tizen
```

Android cihaz/emülatör testleri [apps/android/scripts](./apps/android/scripts/) altındadır.
GitHub Actions sürüm tutarlılığını ve Tizen temel/köprü/altyazı testlerini kontrol eder.
Bir ortak yayın için her platformu ayrı derleyip doğrulayın; ardından aynı Git etiketini kullanın.
Kök sürümü değiştirmek kendiliğinden TV kurulumu veya Raspberry dağıtımı yapmaz.

Üç ayrı indirme hazırlamak ve GitHub Releases bölümüne yüklemek için Windows'ta:

```sh
npm run release:pack
npm run release:publish
```

Paketleme, derlenmiş Android APK ve imzalanmış Tizen WGT bekler. Web ZIP'i yalnız izlenen kaynaklardan oluşturur.
Çıktılar `build/releases/<sürüm>/` altındadır. Yayınlama mevcut GitHub girişini kullanır; erişim belirtecini dosyaya yazmaz.

İlk birleştirme Android 2.0.5, Samsung 2.0.7 geliştirme projesi ve 9 Kasım 2026 Raspberry kaynak aktarımından yapılmıştır.
Raspberry aktarımının orijinal [dosya listesi](./docs/source-import/raspberry-files.json) ve [açıklaması](./docs/source-import/raspberry.md) geçmiş/provenans içindir;
birleştirme sonrası dosyaların hash listesi değildir.

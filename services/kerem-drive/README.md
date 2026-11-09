# Kerem Drive

Raspberry Pi üzerinde kişisel dosya depolama. Adres: `http://192.168.1.240/drive/`

React, Vite, TypeScript, Tailwind CSS, Express ve Node.js SQLite kullanır. Node.js 22.18 veya üzeri gerekir. Vite derlemesi statik dosyalar üretir; sunucu yükleme ve indirmeleri akış olarak işler.

## Dosya alanı

Tek bir dosya alanı, arama, sıralama ve liste/ızgara görünümü bulunur. Dosya veya klasör tek tıklamayla açılır. Sol üstteki seçim kutusu yalnızca seçim yapar; birden fazla kutuyu işaretleyerek çoklu seçim yapılır. Sağ tık veya üç nokta menüsü; açma, indirme, yeniden adlandırma, kesme, taşıma, silme ve özellikleri gösterir. Sağ tıklamak seçim kutusunu değiştirmez. Boş alana sağ tıklayarak yükleme, klasör oluşturma ve yapıştırma işlemleri yapılabilir. Çöp kutusuna üstteki simgeden ulaşılır.

Dosyalar ve klasörler bir klasörün veya üstteki konum yolunun üzerine sürüklenebilir. Seçim kutularıyla çoklu seçim; Ctrl/Cmd+A ile tümünü seçme; Ctrl/Cmd+X ve Ctrl/Cmd+V ile kesme ve taşıma; F2 ile ad değiştirme; Enter ile açma desteklenir. Çoklu taşıma tek SQLite işlemiyle uygulanır; isim çakışmasında hiçbir öğe taşınmaz ve dosyaların üzerine yazılmaz.

PDF, yerel PDF.js görüntüleyicisinde sayfa geçişi ve yakınlaştırma ile açılır. DOCX, Mammoth ve DOMPurify ile güvenli okuma görünümüne çevrilir; özgün Word sayfa düzeni birebir korunmaz. XLSX dosyalarında çalışma sayfası seçilebilir; ilk 1.000 satır ve 50 sütun gösterilir. TXT, CSV, Markdown ve kod/metin dosyaları metin görünümünde; görsel, ses ve video dosyaları tarayıcının desteklediği biçimlerde açılır. DOCX ve XLSX önizleme sınırı 25 MB, metin önizleme sınırı 2 MB'dır. Önizleme dönüşümleri ziyaretçinin tarayıcısında yapılır; dosyalar üçüncü taraf hizmetlere gönderilmez. Eski DOC/XLS ve diğer desteklenmeyen biçimler indirilebilir.

## Çalıştırma

`npm install`, ardından `npm run build` ve `npm start`.

Üretimde systemd servisi `kerem-drive` kullanılır. [Servis tanımı](deploy/kerem-drive.service) ve [Nginx yolu](deploy/drive.conf) dağıtım ayarlarını içerir.

Ortam ayarları `.env` içindedir: `PORT`, `DATA_DIR`, `FILES_DIR`. Giriş ekranı veya uygulama şifresi yoktur; mevcut Nginx yerel ağ kısıtları geçerlidir.

## Depolama ve yedekleme

Dosya içerikleri `/mnt/hdd/kerem-drive/files` altında, isimleri ve klasörleri `/home/kerempi/kerem-drive/data/drive.sqlite` içinde saklanır. Kalıcı kimlikler sayesinde kullanıcının dosya adları disk yollarına dönüşmez. HDD takılı değilse servis başlamaz.

Yedek için servisi durdurup hem `data` klasörünü hem HDD üzerindeki `files` klasörünü birlikte kopyalayın; ardından servisi başlatın. SQLite açıkken yalnızca ana `.sqlite` dosyasını kopyalamayın; WAL verileri de olabilir. Çöp kutusu otomatik boşalmaz ve içindeki dosyalar disk alanı kullanır.

Tek dosya yükleme sınırı 10 GB. Arayüz dosyaları sırayla yükler; kesilen yüklemeler devam ettirilemez ve yeniden seçilmelidir. Görsel, ses, video ve PDF önizlemesi tarayıcı desteğine bağlıdır. Paylaşım bağlantıları ve çok kullanıcılı hesaplar bu sürümde yoktur. Nginx'in mevcut yerel ağ erişim kısıtları korunur.

## Kontroller

`npm run build` TypeScript kontrolü ve üretim derlemesini yapar; PDF'nin font, karakter haritası ve WASM kaynaklarını da yerel çıktıya kopyalar. `python3 deploy/smoke.py`, yalnızca kendi oluşturduğu QA klasörleriyle API akışlarını doğrular ve bunları temizler. `python3 deploy/explorer-smoke.py`, çoklu taşıma ve belge örneklerini denetler; tarayıcı kontrolü için bir QA klasörü bırakır. Sadece bu kontrolün oluşturduğu klasörün kimliği `data/qa-explorer.json` içinde tutulur.

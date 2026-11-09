# keremhub

Raspberry Pi'deki tüm sitelerin giriş sayfası. `http://192.168.1.240/` açılınca eklenen siteler satır satır listelenir, birine tıklayınca o site açılır. Siteler birbirinden bağımsızdır; portal yalnızca adreslerini tutar.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 7 + SQLite, nginx.

## Kurulum (Pi'de, bir kez)

```bash
# bilgisayardan: scp keremhub-portal.zip kerempi@192.168.1.240:~
ssh kerempi@192.168.1.240
unzip keremhub-portal.zip -d keremhub-portal && cd keremhub-portal
bash deploy/setup.sh
```

Sıfır bir Raspberry Pi OS üzerinde de çalışır: Node 22, nginx ve gerekli araçları kendisi kurar (internet bağlantısı gerekir). Betik sırayla: paketleri kurar, SQLite veritabanını oluşturur, derler, nginx'i 80. portta açar ve portalı `keremhub` adlı systemd servisi olarak başlatır. Pi açılınca kendiliğinden gelir.

Derleme 2 GB'lık Pi'de birkaç dakika sürer. Bellek yetmezse betik swap için uyarır.

## Site ekleme

**Portaldan:** sağ üstte *Site ekle*. *Düzenle* ile sıra, ad, renk değiştirilir ve site silinir.

**Terminalden / başka sitenin kurulum betiğinden:**

```bash
curl -X POST http://192.168.1.240/api/siteler -H 'content-type: application/json' \
  -d '{"ad":"Kerem Kitabevi","aciklama":"E-kitap arşivi","yol":"/kitabevi/","ikon":"kitap","renk":"#7C3AED"}'
```

Adres (`yol`) üç biçimde yazılır:

| Yazım | Anlamı |
|---|---|
| `/kitabevi/` | Aynı IP'de nginx üzerinden bir yol |
| `:3200` | Aynı IP'deki 3200. port |
| `http://...` | Başka bir adres |

`ikon`: globe, film, tv, kitap, kutuphane, muzik, foto, kamera, oyun, egitim, indir, klasor, disk, haber, sunucu, ev.

## Yeni bir siteyi aynı IP'den açmak

Her site kendi portunda çalışır, nginx yolu ona yönlendirir. `deploy/ornek-site.conf.disabled` dosyasını `/etc/nginx/keremhub.d/<site>.conf` olarak kopyala, yolu ve portu düzenle, `sudo nginx -t && sudo systemctl reload nginx` çalıştır, sonra portala ekle. Portal ana sayfa olarak `/` yolunu kullandığından site yolları `/kitabevi/`, `/medya/` gibi olmalı.

## Günlük kullanım

```bash
sudo systemctl status keremhub      # durum
journalctl -u keremhub -f           # günlük
bash deploy/guncelle.sh             # kod değişince yeniden derle
```

Veritabanı: `data/keremhub.db` (yedeklemek için kopyalaman yeterli). Disk adları `.env` içindeki `DISK_PATHS` ile ayarlanır.

## Notlar

- Portal yalnızca yerel ağ için tasarlandı ve giriş şifresi yok; internete açma.
- Durum noktası (açık/kapalı) her 30 saniyede sunucudan sorulur.

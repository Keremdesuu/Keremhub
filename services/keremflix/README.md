# Keremflix

Keremhub'a bağlı, yerel ağda çalışan kişisel Dizi / Film / Anime kütüphanesi.
Next.js 16 (React 19) · TypeScript · Tailwind CSS 4 · Prisma 7 (SQLite) · Vitest.

> Vite yerine Next.js'in kendi derleyicisi (Turbopack) kullanılır; ikisi aynı işi yaptığı için birlikte kullanılmaz.
> Testler için Vitest (Vite tabanlı) kurulu.

## Klasör düzeni (HDD)

```
/mnt/keremhub/keremflix/
├─ diziler/
│  └─ Dizi Adı/
│     ├─ Sezon 1/  Dizi.S01E01.mkv ...
│     └─ Sezon 2/  ...
├─ filmler/
│  ├─ Inception (2010)/  Inception.2010.1080p.mp4
│  └─ Tek Dosya Film.2019.mp4
└─ animeler/
   └─ Anime Adı/  [Grup] Anime Adı - 01 [1080p].mp4 ...
```

* Her alt klasör bir başlıktır; sezon klasörleri `Sezon N` / `Season N` / `SN` olabilir.
* Bölüm numarası `S01E02`, `1x02`, `Bölüm 3`, `Başlık - 03` kalıplarından çıkarılır.
* Altyazı: videoyla aynı adlı `.srt` / `.vtt` (`.tr.srt` öncelikli) otomatik bulunur.
* Kalite rozetleri (HD, 4K, HDR) dosya adındaki `1080p`, `2160p`, `HDR` ifadelerinden gelir.

## Kurulum (Pi üzerinde, internet açıkken)

Önce ana portal (keremhub) kurulu olmalı; Keremflix ondan bağımsız çalışır ama nginx'e onun üzerinden eklenir.

```bash
unzip keremflix.zip -d keremflix && cd keremflix
bash deploy/setup.sh
```

Betik Node 22'yi (yoksa), paketleri, veritabanını ve derlemeyi halleder; nginx'e `/keremflix` yolunu ekler, `keremflix` servisini kurar, siteyi ana portala kaydeder ve kütüphaneyi tarar. Sonunda `http://192.168.1.240/keremflix` açılır.

* Uygulama yalnızca `127.0.0.1:3200`'de dinler; ağdan sadece nginx üzerinden (`/keremflix`) erişilir.
* Medya klasörü `.env` içindeki `MEDIA_ROOT` ile belirlenir (varsayılan `/mnt/keremhub/keremflix`).
* TMDB anahtarın varsa `.env` içine `TMDB_API_KEY=` olarak yaz, sonra `npm run scan -- --refetch` çalıştır (filmler ve diziler için).
* Alt yolu değiştirmek istersen `.env` içindeki `NEXT_PUBLIC_BASE_PATH` ve `deploy/nginx-keremflix.conf` birlikte değişir, yeniden derlenir.

## Günlük kullanım

* Yeni içerik ekleyince sağ üstteki zil simgesine tıkla (ya da `npm run scan`).
* Metadata bulunamayanları tekrar denemek için `npm run scan -- --refetch`.
* Geliştirme: `npm run dev` (http://localhost:3200/keremflix), testler: `npm test`.
* Güncelleme sonrası: `bash deploy/guncelle.sh`. Servis: `sudo systemctl status keremflix`, günlük: `journalctl -u keremflix -f`.

## Metadata kaynakları

| Tür | Kaynak |
|---|---|
| Anime | AniList (anahtar gerekmez) |
| Dizi | TMDB (anahtarla), yoksa TVMaze |
| Film | TMDB (anahtar gerekir) |

## Oynatma notu

Video, tarayıcıya olduğu gibi (Range desteğiyle) akıtılır; Pi 5 üzerinde dönüştürme yapılmaz.
**MP4 (H.264 + AAC)** her tarayıcıda çalışır. MKV/AVI bazı tarayıcılarda açılmayabilir;
gerekirse `ffmpeg -i in.mkv -c copy out.mp4` ile kayıpsız mp4'e çevir.

## Kısayollar (oynatıcı)

`Boşluk/K` oynat-duraklat · `←/J` 10 sn geri · `→/L` 10 sn ileri · `↑/↓` ses · `M` sessiz · `F` tam ekran · `N` sonraki bölüm · `C` altyazı

#!/usr/bin/env bash
# Keremflix'i Raspberry Pi'ye kurar. Proje klasöründe çalıştır:  bash deploy/setup.sh
# Bağımsız bir sitedir: yalnızca nginx'e bir yol ekler ve (varsa) ana portala kendini kaydeder.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
USER_NAME="$(id -un)"
PORT=3200
YOL="/keremflix"

echo "==> Temel araçlar kuruluyor"
sudo apt-get update
sudo apt-get install -y curl ca-certificates unzip build-essential python3 nginx

echo "==> Node.js kontrol ediliyor"
node_uygun() {
  command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>=22?0:1)'
}
if ! node_uygun; then
  echo "Node 22 kuruluyor"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
NODE_BIN="$(command -v node)"
echo "Node $(node -v)"

echo "==> Bellek (swap) kontrol ediliyor"
SWAP_MB="$(free -m | awk '/^Swap:/ {print $2}')"
if [ "${SWAP_MB:-0}" -lt 1500 ] && [ -f /etc/dphys-swapfile ]; then
  echo "Swap ${SWAP_MB:-0} MB, derleme için 2048 MB yapılıyor"
  sudo dphys-swapfile swapoff || true
  sudo sed -i 's/^#\?CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
  sudo sed -i 's/^#\?CONF_MAXSWAP=.*/CONF_MAXSWAP=2048/' /etc/dphys-swapfile
  sudo dphys-swapfile setup
  sudo dphys-swapfile swapon
fi

echo "==> .env hazırlanıyor"
[ -f .env ] || cp .env.example .env
mkdir -p data
MEDIA_ROOT="$(grep -E '^MEDIA_ROOT=' .env | tail -1 | cut -d= -f2-)"
MEDIA_ROOT="${MEDIA_ROOT:-/mnt/keremhub/keremflix}"

echo "==> Medya klasörü (HDD) kontrol ediliyor"
# Ayarlı klasör yoksa, bağlı disklerde "keremflix" adlı klasörü ara
if [ ! -d "$MEDIA_ROOT" ]; then
  BULUNAN="$(find /mnt /media -maxdepth 4 -type d -name keremflix 2>/dev/null || true)"
  SAYI="$(printf '%s\n' "$BULUNAN" | sed '/^$/d' | wc -l)"
  if [ "$SAYI" -eq 1 ]; then
    MEDIA_ROOT="$BULUNAN"
    sed -i "s|^MEDIA_ROOT=.*|MEDIA_ROOT=$MEDIA_ROOT|" .env
    echo "HDD'de bulundu, .env güncellendi: MEDIA_ROOT=$MEDIA_ROOT"
  elif [ "$SAYI" -gt 1 ]; then
    echo "UYARI: birden fazla 'keremflix' klasörü var, .env içindeki MEDIA_ROOT'u elle seç:"
    printf '  %s\n' $BULUNAN
  fi
fi

if [ ! -d "$MEDIA_ROOT" ]; then
  echo "UYARI: $MEDIA_ROOT bulunamadı. HDD Pi'ye bağlı ve bağlanmış (mount) mı?"
  echo "       'lsblk -f' ve 'df -h' ile bak. Site yine kurulur; HDD bağlanınca 'npm run scan' ile taratırsın."
else
  KAYNAK="$(findmnt -T "$MEDIA_ROOT" -no SOURCE 2>/dev/null || true)"
  echo "Medya klasörü: $MEDIA_ROOT (disk: ${KAYNAK:-bilinmiyor})"
  case "$KAYNAK" in
    /dev/mmcblk*) echo "UYARI: bu klasör HDD'de değil, Pi'nin SD kartında görünüyor. HDD bağlı mı?" ;;
  esac
  for k in diziler filmler animeler; do
    [ -d "$MEDIA_ROOT/$k" ] || { mkdir -p "$MEDIA_ROOT/$k" 2>/dev/null && echo "  oluşturuldu: $k" || echo "  UYARI: $k oluşturulamadı (yazma izni yok)"; }
  done
  [ -r "$MEDIA_ROOT" ] || echo "UYARI: $MEDIA_ROOT okunamıyor; HDD'yi bağlarken uid/gid ayarını kontrol et."
fi

echo "==> Paketler kuruluyor"
npm ci --no-audit --no-fund

echo "==> Veritabanı oluşturuluyor"
npx prisma db push

echo "==> Derleniyor (birkaç dakika sürebilir)"
NODE_OPTIONS="--max-old-space-size=1536" npm run build

echo "==> nginx yolu ekleniyor ($YOL)"
sudo mkdir -p /etc/nginx/keremhub.d
sudo cp deploy/nginx-keremflix.conf /etc/nginx/keremhub.d/keremflix.conf
if ! sudo grep -Rqs "keremhub.d" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null; then
  echo "UYARI: nginx ayarında /etc/nginx/keremhub.d/ henüz dahil edilmemiş. Önce ana portalı (keremhub) kur."
fi
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "==> Servis kuruluyor"
sed -e "s|__USER__|$USER_NAME|g" -e "s|__DIR__|$DIR|g" -e "s|__NODE__|$NODE_BIN|g" deploy/keremflix.service | sudo tee /etc/systemd/system/keremflix.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable keremflix
sudo systemctl restart keremflix

echo "==> Site denetleniyor"
OK=0
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1${YOL}"; then OK=1; break; fi
  sleep 2
done
if [ "$OK" -ne 1 ]; then
  echo "Servis açılmadı. Kontrol: journalctl -u keremflix -n 50 --no-pager"
  exit 1
fi

echo "==> Ana portala kaydediliyor"
if curl -fsS -o /dev/null "http://127.0.0.1/api/siteler"; then
  VAR="$(curl -fsS http://127.0.0.1/api/siteler | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).some(s=>s.yol==="/keremflix")?"var":"yok")}catch{console.log("yok")}})')"
  if [ "$VAR" = "var" ]; then
    echo "Zaten portalda kayıtlı."
  else
    curl -fsS -X POST http://127.0.0.1/api/siteler -H 'content-type: application/json' \
      -d '{"ad":"Keremflix","aciklama":"Dizi, film ve anime izleme","yol":"/keremflix","ikon":"film","renk":"#E50914"}' >/dev/null \
      && echo "Portala eklendi." || echo "UYARI: portala eklenemedi, portaldan elle ekle (adres: /keremflix)."
  fi
else
  echo "Ana portal bulunamadı; atlandı. Sonradan portaldan 'Site ekle' ile /keremflix adresini ekle."
fi

IP="$(hostname -I | awk '{print $1}')"
echo
echo "Hazır: http://$IP/keremflix"
if [ -d "$MEDIA_ROOT" ] && [ "${SKIP_SCAN:-0}" != "1" ]; then
  echo "==> Kütüphane taranıyor ve metadata çekiliyor (kütüphane büyükse uzun sürebilir; Ctrl+C site çalışmaya devam eder)"
  npm run scan || echo "Tarama tamamlanamadı. Daha sonra: npm run scan"
fi

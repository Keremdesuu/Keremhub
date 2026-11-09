#!/usr/bin/env bash
# keremhub portalını Raspberry Pi'ye kurar. Proje klasöründe çalıştır:  bash deploy/setup.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
USER_NAME="$(id -un)"

echo "==> Temel araçlar kuruluyor"
sudo apt-get update
sudo apt-get install -y curl ca-certificates unzip build-essential python3

echo "==> Node.js kontrol ediliyor"
node_uygun() {
  command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>=23||a===22||(a===20&&b>=19)?0:1)'
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
elif [ "${SWAP_MB:-0}" -lt 1500 ]; then
  echo "Uyarı: swap ${SWAP_MB:-0} MB. Derleme sırasında bellek yetmeyebilir."
fi

echo "==> .env hazırlanıyor"
[ -f .env ] || cp .env.example .env
mkdir -p data

echo "==> Paketler kuruluyor"
npm ci --no-audit --no-fund

echo "==> Veritabanı oluşturuluyor"
npx prisma db push

echo "==> Derleniyor (birkaç dakika sürebilir)"
NODE_OPTIONS="--max-old-space-size=1536" npm run build

echo "==> nginx kuruluyor"
if ! command -v nginx >/dev/null; then sudo apt-get update && sudo apt-get install -y nginx; fi
sudo mkdir -p /etc/nginx/keremhub.d
sudo cp deploy/ornek-site.conf.disabled /etc/nginx/keremhub.d/ornek-site.conf.disabled
sudo cp deploy/nginx-keremhub.conf /etc/nginx/sites-available/keremhub
sudo ln -sf /etc/nginx/sites-available/keremhub /etc/nginx/sites-enabled/keremhub
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "==> Servis kuruluyor"
sed -e "s|__USER__|$USER_NAME|g" -e "s|__DIR__|$DIR|g" -e "s|__NODE__|$NODE_BIN|g" deploy/keremhub.service | sudo tee /etc/systemd/system/keremhub.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable keremhub
sudo systemctl restart keremhub

sleep 3
IP="$(hostname -I | awk '{print $1}')"
if curl -fsS "http://127.0.0.1/api/siteler" >/dev/null; then
  echo "Hazır: http://$IP/ adresini aç."
else
  echo "Servis başlamadı. Kontrol: journalctl -u keremhub -n 50 --no-pager"
  exit 1
fi

#!/usr/bin/env bash
# Kerem Kitabevi kurulumu (Raspberry Pi 5). Proje klasörünün içinden çalıştır:
#   bash deploy/setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
APP_USER="$(whoami)"

echo "==> Node sürümü: $(node -v) (22 veya üstü olmalı)"

echo "==> Bağımlılıklar kuruluyor"
npm install

echo "==> Prisma istemcisi ve veritabanı"
mkdir -p data
npx prisma generate
npx prisma db push

echo "==> Derleniyor (2 GB RAM için bellek sınırı ayarlı)"
NODE_OPTIONS="--max-old-space-size=1536" npm run build

echo "==> systemd servisi kuruluyor"
sed -e "s|__APP_DIR__|${APP_DIR}|g" -e "s|__APP_USER__|${APP_USER}|g" deploy/kerem-kitabevi.service \
  | sudo tee /etc/systemd/system/kerem-kitabevi.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now kerem-kitabevi

echo "==> İlk tarama"
npm run scan || echo "Tarama başarısız: HDD bağlı mı? (.env içindeki LIBRARY_DIR'i kontrol et)"

cat <<EOF

Servis çalışıyor (127.0.0.1:3002). Son adım: nginx'e yönlendirmeyi ekle.
  1) deploy/nginx-location.conf içindeki bloğu Keremhub'ın nginx 'server { }' bölümüne yapıştır
  2) sudo nginx -t && sudo systemctl reload nginx
Sonra tarayıcıda: http://192.168.1.240/keremkitabevi/
EOF

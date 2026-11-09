#!/usr/bin/env bash
# Kod değişikliğinden sonra portalı yeniden derleyip başlatır:  bash deploy/guncelle.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm ci --no-audit --no-fund
npx prisma db push
NODE_OPTIONS="--max-old-space-size=1536" npm run build
sudo systemctl restart keremhub
echo "Güncellendi."

#!/bin/bash
set -eu
cd /home/kerempi/keremkitabevi
mountpoint -q /mnt/hdd || { echo "HDD bağlı değil; sürüm değiştirilmedi."; exit 1; }
test -f .next-book-delete-low/BUILD_ID
test -f .next-book-delete-low/server/app/kitap/\[id\]/page.js
sudo install -m 644 deploy/93-book-delete.conf /etc/systemd/system/kerem-kitabevi.service.d/93-book-delete.conf
sudo systemctl daemon-reload
sudo systemctl restart kerem-kitabevi
sudo systemctl is-active kerem-kitabevi

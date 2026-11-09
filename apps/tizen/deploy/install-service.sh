#!/bin/sh
set -eu
install -m 644 /home/kerempi/keremflix-tizen/deploy/keremflix-tv.service /etc/systemd/system/keremflix-tv.service
systemctl daemon-reload
systemctl enable --now keremflix-tv.service
systemctl --no-pager --full status keremflix-tv.service

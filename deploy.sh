#!/usr/bin/env bash
# StudyExam — Self-hosted deploy scripti
# Kullanım: ./deploy.sh
# Çıktı: deploy/ klasörü — bu klasörü sunucuya kopyala ve çalıştır.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/persistent_data"
mkdir -p "$DATA_DIR"

echo "==> Build alınıyor..."
npm run build

echo "==> Deploy klasörü hazırlanıyor..."
rm -rf deploy
mkdir -p deploy

echo "==> Standalone sunucu kopyalanıyor..."
cp -r .next/standalone/. deploy/

echo "==> Static dosyalar kopyalanıyor..."
cp -r .next/static deploy/.next/static
cp -r public deploy/public 2>/dev/null || true

echo "==> PM2 yeniden başlatılıyor..."
pm2 stop studyexam 2>/dev/null || true
STUDYEXAM_DATA_DIR="$DATA_DIR" PORT=3000 pm2 start deploy/server.js \
  --name studyexam \
  --update-env \
  -- --port 3000 2>/dev/null || \
STUDYEXAM_DATA_DIR="$DATA_DIR" PORT=3000 pm2 restart studyexam --update-env 2>/dev/null || true
pm2 save

echo ""
echo "✓ Deploy tamamlandı."
echo "  Veri klasörü (kalıcı): $DATA_DIR"

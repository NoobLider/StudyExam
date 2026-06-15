#!/usr/bin/env bash
set -e

APP_DIR="/home/arcnomad/Masaüstü/Çalışmalar/StudyExam/studyexam-app"
DATA_DIR="$APP_DIR/persistent_data"
LOG_DIR="/tmp/studyexam-logs"
mkdir -p "$LOG_DIR"

# --- 1. HERŞEYİ KAPAT ---
echo "==> Tunnel kapatılıyor (root yetkisiyle)..."
sudo pkill -9 -f "cloudflared" 2>/dev/null && echo "  root cloudflared durduruldu" || echo "  root cloudflared zaten kapalıydı"
pkill -9 -f "cloudflared" 2>/dev/null && echo "  user cloudflared durduruldu" || echo "  user cloudflared zaten kapalıydı"

echo "==> Uygulama kapatılıyor..."
pkill -9 -f "deploy/server.js" 2>/dev/null && echo "  uygulama durduruldu" || echo "  uygulama zaten kapalıydı"

echo "==> Port 3000 serbest bırakılıyor (root yetkisiyle)..."
sudo fuser -k 3000/tcp 2>/dev/null && echo "  port temizlendi" || echo "  port zaten boştu"
sleep 2

# --- 2. UYGULAMAYI BAŞLAT ---
echo ""
echo "==> Uygulama başlatılıyor..."
STUDYEXAM_DATA_DIR="$DATA_DIR" PORT=3000 node "$APP_DIR/deploy/server.js" \
  > "$LOG_DIR/app.log" 2>&1 &
APP_PID=$!
echo "  PID: $APP_PID"

# Port 3000 açılana kadar bekle
echo "==> Port 3000 bekleniyor..."
for i in $(seq 1 20); do
  if ss -tlnp 2>/dev/null | grep -q ':3000 '; then
    echo "  Port 3000 hazır."
    break
  fi
  printf "."
  sleep 1
done

# --- 3. TUNNEL'I BAŞLAT ---
echo ""
echo "==> Tunnel başlatılıyor..."
> "$LOG_DIR/tunnel.log"
cloudflared tunnel --url http://localhost:3000 \
  > "$LOG_DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!
echo "  PID: $TUNNEL_PID"

# URL oluşana kadar bekle
echo "==> URL bekleniyor..."
for i in $(seq 1 30); do
  URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" 2>/dev/null | tail -1)
  if [ -n "$URL" ]; then
    echo ""
    echo "✓ Uygulama hazır!"
    echo "  URL : $URL"
    echo "  APP PID    : $APP_PID"
    echo "  TUNNEL PID : $TUNNEL_PID"
    echo ""
    echo "  Durdurmak için: kill $APP_PID $TUNNEL_PID"
    exit 0
  fi
  printf "."
  sleep 1
done

echo ""
echo "⚠ URL 30 saniyede alınamadı."
echo "  Tunnel logu: $LOG_DIR/tunnel.log"
echo "  App logu   : $LOG_DIR/app.log"

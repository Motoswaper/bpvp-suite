#!/usr/bin/env sh
# One command: local suite + Cloudflare tunnel so https://testnet.btc-defi.com works.
# From repo root: ./scripts/online-testnet.sh
set -eu

ROOT_DIR="$(cd -P "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"

# Token: env CF_TUNNEL_TOKEN, or first line of .run/cf-tunnel.token (file is gitignored)
TOKEN="${CF_TUNNEL_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$RUN_DIR/cf-tunnel.token" ]; then
  TOKEN="$(head -n 1 "$RUN_DIR/cf-tunnel.token" | tr -d '\r')"
fi

echo "== [1/2] Backend + dashboard (Docker + localhost:3100) =="
"$ROOT_DIR/scripts/start-suite.sh"

if [ -z "$TOKEN" ]; then
  echo ""
  echo "== Tunnel skipped (no token) =="
  echo "Solo tienes el sitio en esta Mac: http://127.0.0.1:3100"
  echo ""
  echo "Para poner testnet.btc-defi.com EN INTERNET, haz UNA vez:"
  echo "  printf '%s\\n' 'PEGAR_TOKEN_AQUI' > \"$RUN_DIR/cf-tunnel.token\""
  echo "  chmod 600 \"$RUN_DIR/cf-tunnel.token\""
  echo "Y vuelve a ejecutar:"
  echo "  ./scripts/online-testnet.sh"
  exit 0
fi

echo ""
echo "== [2/2] Cloudflare tunnel (contenedor: bpvp-cloudflared-domain) =="
docker rm -f bpvp-cloudflared-domain >/dev/null 2>&1 || true
docker run -d --name bpvp-cloudflared-domain --restart unless-stopped \
  cloudflare/cloudflared:latest tunnel --no-autoupdate run --token "$TOKEN" >/dev/null

echo ""
echo "Listo. Prueba:"
echo "  curl -sS https://testnet.btc-defi.com/api/public/overview | head -c 200"
echo ""
echo "NOTA: ./scripts/stop-suite.sh para el tunel tambien. Si lo usas, vuelve a correr ./scripts/online-testnet.sh"

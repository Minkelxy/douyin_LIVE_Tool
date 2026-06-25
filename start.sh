#!/bin/bash
# 抖音直播弹幕工具 - 一键启动脚本
# 用法: ./start.sh [后端端口] [Go代理端口] [Caddy端口(可选)]

PORT=${1:-3001}
PROXY_PORT=${2:-1088}
CADDY_PORT=${3:-0}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_BIN="$SCRIPT_DIR/api/douyinLive-proxy"

echo "╔══════════════════════════════════════════╗"
echo "║     抖音直播弹幕工具                       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 启动 Go 代理
if [ -f "$PROXY_BIN" ]; then
  echo "[1/3] 启动抖音代理 (port $PROXY_PORT)..."
  "$PROXY_BIN" --port "$PROXY_PORT" --log-level warn &
  PROXY_PID=$!
  sleep 1
else
  echo "[警告] 未找到 douyinLive-proxy，抖音直播功能不可用"
fi

# 启动 Node.js 后端
echo "[2/3] 启动 Web 服务 (port $PORT)..."
cd "$SCRIPT_DIR/api"
DOUYIN_PROXY_URL="ws://127.0.0.1:$PROXY_PORT" PORT="$PORT" node dist/index.js &
NODE_PID=$!

# 可选启动 Caddy
if [ "$CADDY_PORT" -gt 0 ] && command -v caddy &>/dev/null; then
  echo "[3/3] 启动 Caddy 反向代理 (port $CADDY_PORT)..."
  CADDY_HTTP_PORT=$CADDY_PORT caddy run --config "$SCRIPT_DIR/Caddyfile" --adapter caddyfile &
  CADDY_PID=$!
  echo ""
  echo "  打开浏览器访问: http://117.72.184.12:$CADDY_PORT/douyin-live/"
else
  echo "[3/3] Caddy 未启用"
  echo ""
  echo "  直接访问: http://localhost:$PORT"
  echo "  或用 Caddy: ./start.sh 3001 1088 8080"
fi

echo "  按 Ctrl+C 停止所有服务"
echo ""

# 等待
trap "kill $PROXY_PID $NODE_PID $CADDY_PID 2>/dev/null; exit 0" INT TERM
wait

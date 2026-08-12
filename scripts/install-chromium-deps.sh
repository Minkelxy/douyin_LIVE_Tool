#!/usr/bin/env bash
# 无 sudo 安装 Playwright chromium 所需的系统库（Ubuntu/Debian）。
#
# 原理：用 apt-get download 下载 .deb 到临时目录，dpkg -x 解压到用户目录，
# 由 run-e2e.sh 通过 LD_LIBRARY_PATH 注入。适用于无法 sudo 安装系统包的环境。
# 有 sudo 的环境直接 `sudo npx playwright install-deps chromium` 即可，无需此脚本。
set -euo pipefail

TARGET="$HOME/.local/share/playwright-libs/usr/lib/x86_64-linux-gnu"
PKGS=(
  libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libgbm1
  libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2
  libwayland-server0 libwayland-client0 libwayland-cursor0 libwayland-egl1
  libxcb-randr0 libxi6
)

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
apt-get download "${PKGS[@]}" >/dev/null
for f in *.deb; do dpkg -x "$f" extracted/; done

mkdir -p "$(dirname "$TARGET")"
cp -r extracted/usr/lib/x86_64-linux-gnu/. "$TARGET"

echo "依赖库已安装到 $TARGET"
echo "随后运行: npm run test:e2e"

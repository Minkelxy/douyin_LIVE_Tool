#!/usr/bin/env bash
# 运行 Playwright E2E（构建前端后执行）。
#
# 本机若无法用 sudo 安装 chromium 系统依赖（见 CLAUDE.md），可用
# scripts/install-chromium-deps.sh 在用户目录解压依赖库，脚本会自动注入
# LD_LIBRARY_PATH。其他环境（系统已装好依赖）此目录不存在则跳过，无副作用。
set -euo pipefail

LIBS="$HOME/.local/share/playwright-libs/usr/lib/x86_64-linux-gnu"
if [ -d "$LIBS" ]; then
  export LD_LIBRARY_PATH="$LIBS${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

npm run build >/dev/null
exec npx playwright test "$@"

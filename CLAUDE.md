# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

直播弹幕互动工具：为主播提供实时弹幕查看与互动的管理面板，支持模拟数据 / B站 / 抖音三种弹幕源，内置自动回复、弹幕抽奖、弹幕投票、礼物感谢功能。所有代码注释、README 均为中文。

## 常用命令

前端（仓库根目录，ESM）与后端（`api/`，CommonJS）是两套独立的 `package.json`，需分别安装依赖。自测分层：单测（vitest）→ 后端冒烟（test:api）→ 浏览器 E2E（test:e2e）。改动后至少跑对应层级的自测，而不只依赖 `tsc` 通过。

```bash
# 前端
npm install
npm run dev          # Vite 开发服务器（base 为 /douyinlive/，访问 http://localhost:5173/douyinlive/）
npm run build        # tsc -b && vite build，产物在 dist/
npm run check        # tsc --noEmit 类型检查
npm run lint         # eslint（覆盖 **/*.{ts,tsx}，含 api/ 下的 ts 文件）
npm test             # vitest 单测（src/**/*.test.{ts,tsx} 纯函数/hook/组件 + api/src 协议解析）
npm run test:api     # 后端 API 冒烟测试（构建 api → 起服务 → 校验 health/404/SPA/socket 握手）
npm run test:e2e     # Playwright 浏览器 E2E（先 build 再跑；需先 npx playwright install chromium）
npm run preview      # 预览构建产物

# 后端
cd api && npm install
cd api && npm run build   # tsc → dist/index.js
cd api && npm start       # node dist/index.js（默认端口 3001）
cd api && npm run dev     # 仅 tsc 后直接运行，无 watch 模式
```

一键启动：`./start.sh [后端端口=3001] [Go代理端口=1088] [Caddy端口]`。会依次启动 Go 抖音代理、Node 后端，并重载系统 Caddy。**前端必须先用 `npm run build` 构建**，后端才会托管 `dist/` 下的静态资源。

开发模式：两个终端分别跑 `npm run dev`（前端）和 `cd api && npm run dev`（后端）。非生产环境前端 socket 连 `http://localhost:3001`，生产环境连同源 `/douyinlive/socket.io`。

## 架构与数据流

单页 React 应用 + Express/Socket.IO 后端，没有数据库。弹幕从平台源流入到 UI 的路径：

```
弹幕源 → 后端规范化 → io.emit('danmu') → 前端 useDanmu 监听 → danmus state
                                              ↓
                       App.tsx 处理所有未处理过的非回复弹幕（已处理 id 幂等守卫）
                                              ↓
                       processDanmuInteractions（自动回复/礼物/抽奖/投票）
```

三种弹幕源，接入点完全不同：

- **mock（模拟）** — 纯前端，不走 socket。`useDanmu.connect()` 里用 `setInterval` 调 `src/utils/mockDanmu.ts` 的 `generateRandomDanmu()`。
- **bilibili** — `api/src/bilibili.ts` 的 `BilibiliLive` 类直连 B站 WebSocket（`wss://broadcastlv.chat.bilibili.com:2245/sub`），手写二进制协议封包（join/心跳/op=5 消息帧），在 `handleNotifications` 里解析 `DANMU_MSG`/`SEND_GIFT`/`INTERACT_WORD` 等 cmd 并规范化为 `DanmuMessage`。
- **douyin** — `api/src/douyin.ts` 的 `DouyinLive` 类不直连抖音，而是连本地 Go 代理 `ws://127.0.0.1:1088/ws/{roomId}`（环境变量 `DOUYIN_PROXY_URL` 可覆盖）。Go 代理二进制 `api/douyinLive-proxy`（来自开源项目 jwwsjlm/douyinLive，已被 .gitignore 排除）负责解码抖音 Webcast 消息，转发带 `method` 字段的 JSON（`WebcastChatMessage`/`WebcastGiftMessage`/`WebcastLikeMessage`/`WebcastMemberMessage`/`WebcastSocialMessage`）。**没有该二进制，抖音模式不可用**（start.sh 会警告但继续启动）。

### 后端连接管理（api/src/index.ts）

- Socket.IO 事件已类型化：`Server<DanmuClientEvents, DanmuServerEvents>`，客户端 `join {platform, roomId}` → 按 `platform-roomId` 建 `LiveSession`（会话 Map 复用，同一房间多客户端共享一条平台连接）；`disconnect` 时若房间无人则清理会话。事件类型定义在 `api/src/types.ts`。
- 后端通过 `io.emit('danmu')` / `io.emit('status')` 广播，消息统一为 `DanmuMessage` 类型（定义在 `api/src/types.ts`，各模块从这里导入）。
- `BilibiliLive` 和 `DouyinLive` 结构几乎相同：`setCallbacks` / `connect` / `disconnect` / `isConnected` / 指数退避重连（1s 起，上限 30s）。

### 前端交互逻辑（useInteraction + App.tsx）

- `src/utils/interactions.ts` 是所有互动匹配的**纯函数**（`matchAutoReply` / `matchGiftReply` / `canJoinLottery` / `resolveVote` / 规则清洗），可独立单测（见 `src/utils/*.test.ts`）。
- `src/hooks/useInteraction.ts` 只做状态管理，调用上面的纯函数：自动回复（关键词**包含/完全匹配**，`matchMode` 字段，缺省包含）、礼物感谢（正则 `^\[礼物\] (.+?) x(\d+)$`）、抽奖（关键词触发参与 + 随机抽）、投票（关键词+选项编号，1 基编号）。**投票/抽奖的判重基于渲染期状态（`voteResults` / `lotteryParticipants`），不在 setState updater 里做，返回值可靠**。自动回复和礼物规则持久化到 localStorage（key：`danmu_auto_reply_rules`、`danmu_gift_reply_rules`），加载时经 `sanitize*` 清洗，空关键词/坏数据回退默认规则。
- **互动处理在 `App.tsx`**：`useEffect` 基于 **`allDanmus`（未筛选）** 处理所有未处理过的非回复弹幕，`processedDanmuIds` ref 做幂等守卫（每条弹幕恰好处理一次）。用 allDanmus 是为了让被筛选关键词过滤掉的弹幕也参与互动，且筛选变化不会因数组引用变化而重复处理旧弹幕导致重复自动回复。`sendReply` 生成的回复弹幕 `isReply: true` 不会再次触发互动。互动逻辑不依赖后端。
- `useDanmu` 提供 `error` 状态（`connect_error`、join 返回 `connected:false` 时设置，Header 红色横幅展示），并把平台与房间号持久化到 localStorage（key：`danmu_connection_settings`），刷新后恢复。前端 socket.io-client 的事件载荷也做了类型化。

## 关键注意点

- 根目录 `tsconfig.json` 的 include 同时覆盖 `src` 和 `api`，并配置了 `@/*` → `./src/*` 路径别名（vite-tsconfig-paths 处理）。
- `api/package.json` 是 `"type": "commonjs"`（编译产物用 `require`），根目录是 `"type": "module"`。两者别混淆。
- 弹幕消息的规范化类型 `DanmuMessage` 在 `api/src/types.ts`，B站/抖音两个连接模块与 `index.ts` 都从它导入。
- Vite `base: '/douyinlive/'`，生产部署走 Caddy 反向代理（`http://117.72.184.12/douyinlive/`）。
- `.trae/documents/` 下的 TechnicalArchitecture.md、PRD.md 已过时（只描述 mock 单机版本），以实际代码和 README 为准。
- 弹幕 ID 无自增，均为 `Date.now()-随机串` 拼出来的字符串，去重/匹配靠 username 等业务字段。
- **设计约束（确认不需要）**：手动回复与自动回复只在本地面板弹幕列表展示（`generateReplyDanmu` 生成 `isReply` 弹幕），不会发送到 B站/抖音直播间——发送需要平台 API 和登录凭据，已明确不做。改动相关代码时注意别让用户误以为回复已上屏，也不要把它当作缺失功能去实现。

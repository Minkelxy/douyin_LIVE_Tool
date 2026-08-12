# 直播弹幕互动工具

实时直播弹幕互动管理面板，支持 B站、抖音直播弹幕获取，提供自动回复、弹幕抽奖、弹幕投票、礼物感谢等互动功能。

## 功能

- **弹幕获取** — 支持模拟数据、B站直播、抖音直播三种模式
- **自动回复** — 关键词匹配（支持包含/完全匹配两种方式）自动发送预设回复
- **弹幕抽奖** — 设置关键词，观众发送弹幕参与，随机抽取中奖者
- **弹幕投票** — 创建投票，观众发送弹幕参与，实时查看结果
- **礼物感谢** — 模板化礼物感谢自动回复
- **弹幕筛选** — 按关键词过滤弹幕展示

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + TailwindCSS |
| 后端 | Node.js + Express + Socket.IO |
| 弹幕接入 | WebSocket (B站直连 / 抖音 Go 代理) |
| 图标 | Lucide React |

## 快速开始

### 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd api && npm install && cd ..
```

### 构建前端

```bash
npm run build
```

### 启动服务

```bash
# 方式一：一键启动（需要 Go 代理二进制文件 api/douyinLive-proxy）
./start.sh

# 方式二：单独启动后端
cd api && npm start
```

启动后访问 `http://localhost:3001`。

### 开发模式

```bash
# 前端开发服务器
npm run dev

# 后端开发服务器（需要先构建）
cd api && npm run dev
```

### 检查与测试

```bash
npm run check   # TypeScript 类型检查
npm run lint    # ESLint
npm test        # vitest 单测（互动匹配、hook、UI 组件、B站协议解析）
npm run test:api  # 后端 API 冒烟测试（health/404/SPA/socket 握手）
npm run test:e2e  # 浏览器 E2E（需先 npx playwright install chromium）
```

## 项目结构

```
├── src/                    # 前端 React 应用
│   ├── components/         # UI 组件
│   │   ├── Header.tsx           # 顶部工具栏（含连接失败错误横幅）
│   │   ├── DanmuList.tsx        # 弹幕列表
│   │   ├── DanmuItem.tsx        # 单条弹幕
│   │   ├── ReplyInput.tsx       # 回复输入框
│   │   ├── InteractionSidebar.tsx # 互动工具侧边栏
│   │   ├── AutoReplyPanel.tsx   # 自动回复规则配置
│   │   ├── LotteryPanel.tsx     # 弹幕抽奖
│   │   ├── VotePanel.tsx        # 弹幕投票
│   │   └── GiftReplyPanel.tsx   # 礼物感谢回复
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useDanmu.ts         # 弹幕连接与管理（Socket.IO 事件已类型化）
│   │   └── useInteraction.ts   # 互动状态管理（调用 utils/interactions 纯函数）
│   ├── types/              # TypeScript 类型定义
│   └── utils/
│       ├── interactions.ts     # 自动回复/抽奖/投票/礼物的纯函数匹配逻辑
│       ├── interactions.test.ts# 互动逻辑单元测试
│       ├── mockDanmu.ts        # 模拟弹幕生成器
│       └── mockDanmu.test.ts   # mock 弹幕测试
├── api/                    # Node.js 后端
│   ├── src/
│   │   ├── index.ts            # Express + Socket.IO 服务入口（事件已类型化）
│   │   ├── types.ts            # DanmuMessage 与 Socket.IO 事件类型
│   │   ├── douyin.ts           # 抖音直播连接（经 Go 代理）
│   │   └── bilibili.ts         # B站直播连接
│   └── douyinLive-proxy        # Go 抖音代理（二进制）
├── start.sh                # 一键启动脚本
├── vitest.config.ts        # vitest 测试配置
└── vite.config.ts
```

# 直播弹幕互动工具

实时直播弹幕互动管理面板，支持 B站、抖音直播弹幕获取，提供自动回复、弹幕抽奖、弹幕投票、礼物感谢等互动功能。

## 功能

- **弹幕获取** — 支持模拟数据、B站直播、抖音直播三种模式
- **自动回复** — 关键词匹配自动发送预设回复
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

## 项目结构

```
├── src/                    # 前端 React 应用
│   ├── components/         # UI 组件
│   │   ├── Header.tsx           # 顶部工具栏
│   │   ├── DanmuList.tsx        # 弹幕列表
│   │   ├── DanmuItem.tsx        # 单条弹幕
│   │   ├── ReplyInput.tsx       # 回复输入框
│   │   ├── InteractionSidebar.tsx # 互动工具侧边栏
│   │   ├── AutoReplyPanel.tsx   # 自动回复规则配置
│   │   ├── LotteryPanel.tsx     # 弹幕抽奖
│   │   ├── VotePanel.tsx        # 弹幕投票
│   │   └── GiftReplyPanel.tsx   # 礼物感谢回复
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useDanmu.ts         # 弹幕连接与管理
│   │   └── useInteraction.ts   # 互动功能逻辑
│   ├── types/              # TypeScript 类型定义
│   └── utils/              # 工具函数
│       └── mockDanmu.ts        # 模拟弹幕生成器
├── api/                    # Node.js 后端
│   ├── src/
│   │   ├── index.ts            # Express + Socket.IO 服务入口
│   │   ├── douyin.ts           # 抖音直播连接
│   │   └── bilibili.ts         # B站直播连接
│   └── douyinLive-proxy        # Go 抖音代理（二进制）
├── start.sh                # 一键启动脚本
└── vite.config.ts
```

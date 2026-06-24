# 直播弹幕互动工具 - 技术架构文档

## 1. 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                     前端应用                              │
├─────────────────────────────────────────────────────────┤
│  UI层：React组件 + TailwindCSS                           │
│  状态层：React Hooks (useState, useEffect, useRef)       │
│  数据层：模拟弹幕生成器 + 定时器                           │
└─────────────────────────────────────────────────────────┘
```

## 2. 技术选型

| 类别 | 技术 |
|------|------|
| 框架 | React 18 |
| 语言 | TypeScript |
| 构建工具 | Vite |
| 样式方案 | TailwindCSS |
| 动画 | CSS Transitions + Keyframes |

## 3. 组件结构

```
src/
├── App.tsx              # 主应用组件
├── components/
│   ├── Header.tsx       # 顶部工具栏
│   ├── DanmuList.tsx    # 弹幕展示列表
│   ├── DanmuItem.tsx    # 单条弹幕
│   ├── ReplyInput.tsx   # 回复输入区
│   └── StatusIndicator.tsx  # 连接状态指示器
├── hooks/
│   └── useDanmu.ts      # 弹幕数据管理Hook
├── utils/
│   └── mockDanmu.ts     # 模拟弹幕生成器
└── types/
    └── danmu.ts         # 类型定义
```

## 4. 数据模型

```typescript
interface Danmu {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  color?: string;
}

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected';
  platform: string;
}
```

## 5. 核心功能实现

### 5.1 弹幕获取
- 使用 setInterval 定时生成模拟弹幕
- 弹幕池包含预设的用户名和消息模板
- 随机组合生成多样化的弹幕内容

### 5.2 弹幕展示
- CSS 动画实现弹幕从右向左滚动
- 每条弹幕独立动画，使用 animation-delay 实现错落效果
- 超过一定数量自动清除旧弹幕

### 5.3 弹幕回复
- 输入框获取用户回复内容
- 发送后显示在弹幕列表中（带特殊标识）
- 清空输入框准备下一条回复

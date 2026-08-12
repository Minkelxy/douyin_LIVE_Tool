import { defineConfig } from '@playwright/test';

// E2E 配置：vite preview 托管构建产物，浏览器模式覆盖核心 UI 流程。
// 运行前需先 `npm run build`（test:e2e 脚本会自动构建）。
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/douyinlive',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npx vite preview --port 4173',
    port: 4173,
    reuseExistingServer: true,
  },
});

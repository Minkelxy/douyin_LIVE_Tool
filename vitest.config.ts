import { defineConfig } from 'vitest/config';

// 独立的测试配置：不加载 react/traeBadge 等前端构建插件，纯跑单测
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'api/src/**/*.test.ts'],
  },
});

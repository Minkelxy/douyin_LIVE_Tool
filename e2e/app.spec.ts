import { test, expect } from '@playwright/test';

/**
 * 前端核心流程 E2E（模拟数据模式，无需后端）。
 * 依赖: npm run build 产物由 vite preview 托管（playwright.config.ts 的 webServer 自动启动）。
 */

test('页面加载：标题、头部与未连接状态', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('直播弹幕互动工具');
  await expect(page.getByRole('heading', { name: '弹幕互动' })).toBeVisible();
  await expect(page.getByText('未连接')).toBeVisible();
  // 空弹幕占位
  await expect(page.getByText('暂无弹幕，点击连接开始')).toBeVisible();
});

test('模拟数据连接后弹幕滚动出现', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '连接' }).click();
  await expect(page.getByText('已连接')).toBeVisible();
  // 模拟弹幕在数秒内开始滚动
  await expect(page.getByTestId('danmu-item').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('danmu-item').first()).not.toHaveCount(0);
});

test('自动回复规则：新增、切换匹配方式、删除', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自动回复' }).click();

  // 新增规则
  await page.getByTestId('auto-keyword').fill('测试关键词');
  await page.getByTestId('auto-reply').fill('收到测试回复');
  await page.getByRole('button', { name: '添加规则' }).click();
  await expect(page.getByText('测试关键词')).toBeVisible();
  await expect(page.getByText('收到测试回复')).toBeVisible();

  // 切换匹配方式（默认包含 → 完全匹配）
  await page.getByText('包含', { exact: true }).click();
  await expect(page.getByText('完全匹配', { exact: true }).first()).toBeVisible();

  // 删除
  await page.getByRole('button', { name: '删除规则' }).click();
  await expect(page.getByText('测试关键词')).toHaveCount(0);
});

test('抽奖：开始与停止', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '抽奖' }).click();
  await page.getByTestId('lottery-keyword').fill('抽奖');
  await page.getByRole('button', { name: '开始抽奖' }).click();

  // 进行中：出现抽取按钮与参与人数
  await expect(page.getByRole('button', { name: '抽取中奖者' })).toBeVisible();
  await expect(page.getByText('0 人参与')).toBeVisible();

  // 停止 → 回到开始表单
  await page.getByRole('button', { name: '停止' }).click();
  await expect(page.getByTestId('lottery-keyword')).toBeVisible();
});

test('投票：创建、结束、开始新投票', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '投票' }).click();

  await page.getByTestId('vote-title').fill('玩什么');
  await page.getByTestId('vote-options').fill('王者荣耀\n英雄联盟');
  await page.getByTestId('vote-keyword').fill('投票');
  await page.getByRole('button', { name: '开始投票' }).click();

  // 投票进行中，选项可见
  await expect(page.getByText('王者荣耀')).toBeVisible();
  await expect(page.getByText('英雄联盟')).toBeVisible();

  // 结束 → 已结束
  await page.getByRole('button', { name: '结束投票' }).click();
  await expect(page.getByText('投票已结束')).toBeVisible();

  // 开始新投票 → 回到创建表单
  await page.getByRole('button', { name: '开始新投票' }).click();
  await expect(page.getByTestId('vote-title')).toBeVisible();
});

test('平台切换：非模拟模式出现房间号输入', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'B站直播' }).click();
  await expect(page.getByPlaceholder('直播间ID')).toBeVisible();
  // 未填房间号时连接按钮禁用
  await expect(page.getByRole('button', { name: '连接' })).toBeDisabled();
});

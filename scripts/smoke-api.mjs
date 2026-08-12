/**
 * 后端 API 冒烟测试：构建 api → 启动服务器 → 校验关键路由 → 清理。
 * 用法: npm run test:api
 * 覆盖: /api/health、未知 API 404、SPA fallback、socket.io 握手
 */
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'api');
const PORT = 3100 + Math.floor(Math.random() * 100);
const base = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;

async function run(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failed = true;
    console.error(`  ✗ ${label}: ${e.message}`);
  }
}

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch { /* 尚未就绪 */ }
    await sleep(250);
  }
  throw new Error('服务未在预期时间内启动');
}

console.log('构建 api...');
const build = spawnSync('npm', ['run', 'build'], { cwd: apiDir, stdio: 'ignore' });
if (build.status !== 0) {
  console.error('api 构建失败');
  process.exit(1);
}

console.log(`启动服务器 (port ${PORT})...`);
const server = spawn('node', ['dist/index.js'], {
  cwd: apiDir,
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

try {
  await waitReady();

  await run('GET /api/health → 200 {status:ok}', async () => {
    const res = await fetch(`${base}/api/health`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const body = await res.json();
    if (body.status !== 'ok') throw new Error('body.status !== ok');
  });

  await run('GET /api/unknown → 404 JSON', async () => {
    const res = await fetch(`${base}/api/unknown`);
    if (res.status !== 404) throw new Error(`status ${res.status}`);
  });

  await run('GET / → 200 text/html（SPA fallback）', async () => {
    const res = await fetch(`${base}/`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error(`content-type ${type}`);
  });

  await run('GET /socket.io/ 握手 → 200', async () => {
    const res = await fetch(`${base}/socket.io/?EIO=4&transport=polling`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
  });

  console.log(failed ? '\nAPI 冒烟测试：有失败项' : '\nAPI 冒烟测试：全部通过');
} finally {
  server.kill();
}

// 用 exitCode 而非 process.exit()，避免截断未刷新的 stdout
process.exitCode = failed ? 1 : 0;

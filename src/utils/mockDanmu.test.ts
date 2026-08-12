import { describe, it, expect } from 'vitest';
import { generateRandomDanmu, generateReplyDanmu } from './mockDanmu';

describe('generateRandomDanmu', () => {
  it('生成结构完整的弹幕', () => {
    const d = generateRandomDanmu();
    expect(d.id).toMatch(/^danmu-/);
    expect(typeof d.username).toBe('string');
    expect(d.username.length).toBeGreaterThan(0);
    expect(typeof d.content).toBe('string');
    expect(d.content.length).toBeGreaterThan(0);
    expect(typeof d.timestamp).toBe('number');
    expect(d.color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('多次生成的 id 不重复', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRandomDanmu().id));
    expect(ids.size).toBe(100);
  });
});

describe('generateReplyDanmu', () => {
  it('生成带回复标记的弹幕', () => {
    const d = generateReplyDanmu('欢迎光临');
    expect(d.isReply).toBe(true);
    expect(d.username).toBe('我');
    expect(d.content).toBe('欢迎光临');
    expect(d.id).toMatch(/^reply-/);
  });
});

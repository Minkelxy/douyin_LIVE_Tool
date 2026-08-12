import { describe, it, expect } from 'vitest';
import { parseBilibiliEvent } from './bilibiliParse';

describe('parseBilibiliEvent', () => {
  it('DANMU_MSG 解析弹幕内容与用户名', () => {
    const msg = parseBilibiliEvent({
      cmd: 'DANMU_MSG',
      info: [0, '666666', ['', '观众A', 0], 0],
    });
    expect(msg).toMatchObject({
      username: '观众A',
      content: '666666',
      platform: 'bilibili',
    });
  });

  it('SEND_GIFT 解析礼物名与数量', () => {
    const msg = parseBilibiliEvent({
      cmd: 'SEND_GIFT',
      data: { uname: '观众B', giftName: '小心心', num: 2 },
    });
    expect(msg?.content).toBe('[礼物] 小心心 x2');
    expect(msg?.username).toBe('观众B');
  });

  it('INTERACT_WORD 区分关注与进场', () => {
    expect(parseBilibiliEvent({ cmd: 'INTERACT_WORD', data: { uname: '观众C', msg_type: 1 } })?.content)
      .toBe('[进入直播间]');
    expect(parseBilibiliEvent({ cmd: 'INTERACT_WORD', data: { uname: '观众C', msg_type: 2 } })?.content)
      .toBe('[关注了主播]');
  });

  it('WELCOME 解析进场', () => {
    expect(parseBilibiliEvent({ cmd: 'WELCOME', data: { uname: '观众D' } }))
      .toMatchObject({ username: '观众D', content: '[进入直播间]' });
  });

  it('GUARD_BUY 解析开通舰长', () => {
    expect(parseBilibiliEvent({ cmd: 'GUARD_BUY', data: { username: '观众E', gift_name: '舰长' } })?.content)
      .toBe('[开通舰长] 舰长');
  });

  it('无法识别的 cmd 返回 null', () => {
    expect(parseBilibiliEvent({ cmd: 'UNKNOWN_CMD', data: {} })).toBeNull();
  });

  it('结构不完整返回 null', () => {
    expect(parseBilibiliEvent(null)).toBeNull();
    expect(parseBilibiliEvent('not-object')).toBeNull();
    expect(parseBilibiliEvent({ cmd: 'DANMU_MSG' })).toBeNull();
  });
});

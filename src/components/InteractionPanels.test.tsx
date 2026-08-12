// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AutoReplyPanel } from './AutoReplyPanel';
import { LotteryPanel } from './LotteryPanel';
import { VotePanel } from './VotePanel';
import type { AutoReplyRule, LotteryParticipant, VoteSession } from '../types/interaction';

afterEach(cleanup);

const noop = () => {};

describe('AutoReplyPanel', () => {
  it('填写关键词/回复后添加规则（默认包含匹配）', () => {
    const onAdd = vi.fn();
    render(<AutoReplyPanel rules={[]} onAdd={onAdd} onRemove={noop} onUpdate={noop} />);

    fireEvent.change(screen.getByTestId('auto-keyword'), { target: { value: '你好' } });
    fireEvent.change(screen.getByTestId('auto-reply'), { target: { value: '嗨' } });
    fireEvent.click(screen.getByRole('button', { name: '添加规则' }));

    expect(onAdd).toHaveBeenCalledWith('你好', '嗨', 'contains');
  });

  it('展示规则列表并支持切换匹配方式', () => {
    const onUpdate = vi.fn();
    const rules: AutoReplyRule[] = [
      { id: '1', keyword: '666', reply: '感谢支持', enabled: true, matchMode: 'contains' },
    ];
    render(<AutoReplyPanel rules={rules} onAdd={noop} onRemove={noop} onUpdate={onUpdate} />);

    expect(screen.getByText('666')).not.toBeNull();
    // 点击规则行上的「包含」徽标切换为完全匹配（按钮里只有这一个叫「包含」）
    fireEvent.click(screen.getByRole('button', { name: '包含' }));
    expect(onUpdate).toHaveBeenCalledWith('1', { matchMode: 'exact' });
  });

  it('删除规则', () => {
    const onRemove = vi.fn();
    const rules: AutoReplyRule[] = [
      { id: '1', keyword: '666', reply: '感谢支持', enabled: true },
    ];
    render(<AutoReplyPanel rules={rules} onAdd={noop} onRemove={onRemove} onUpdate={noop} />);
    fireEvent.click(screen.getByRole('button', { name: '删除规则' }));
    expect(onRemove).toHaveBeenCalledWith('1');
  });
});

describe('LotteryPanel', () => {
  it('输入关键词开始抽奖', () => {
    const onStart = vi.fn();
    render(<LotteryPanel active={false} keyword="" participants={[]} result={null} onStart={onStart} onDraw={noop} onStop={noop} />);

    fireEvent.change(screen.getByTestId('lottery-keyword'), { target: { value: '抽奖' } });
    fireEvent.click(screen.getByRole('button', { name: '开始抽奖' }));
    expect(onStart).toHaveBeenCalledWith('抽奖');
  });

  it('进行中展示参与人数与名单，抽取按钮在无参与者时禁用', () => {
    const participants: LotteryParticipant[] = [
      { id: 'p1', username: '观众A', content: '抽奖', timestamp: 0 },
    ];
    const { rerender } = render(<LotteryPanel active={false} keyword="" participants={[]} result={null} onStart={noop} onDraw={noop} onStop={noop} />);
    rerender(<LotteryPanel active keyword="抽奖" participants={participants} result={null} onStart={noop} onDraw={noop} onStop={noop} />);

    expect(screen.getByText('1 人参与')).not.toBeNull();
    expect(screen.getByText('观众A')).not.toBeNull();
    const drawBtn = screen.getByRole('button', { name: '抽取中奖者' }) as HTMLButtonElement;
    expect(drawBtn.disabled).toBe(false);
  });

  it('停止抽奖', () => {
    const onStop = vi.fn();
    render(<LotteryPanel active keyword="抽奖" participants={[]} result={null} onStart={noop} onDraw={noop} onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: '停止' }));
    expect(onStop).toHaveBeenCalled();
  });
});

describe('VotePanel', () => {
  it('填写主题/选项/关键词后开始投票', () => {
    const onStart = vi.fn();
    render(<VotePanel session={null} onStart={onStart} onEnd={noop} onReset={noop} getResults={() => null} />);

    fireEvent.change(screen.getByTestId('vote-title'), { target: { value: '玩什么' } });
    fireEvent.change(screen.getByTestId('vote-options'), { target: { value: '王者荣耀\n英雄联盟' } });
    fireEvent.change(screen.getByTestId('vote-keyword'), { target: { value: '投票' } });
    fireEvent.click(screen.getByRole('button', { name: '开始投票' }));

    expect(onStart).toHaveBeenCalledWith('玩什么', ['王者荣耀', '英雄联盟'], '投票');
  });

  it('投票进行中展示选项与票数', () => {
    const session: VoteSession = {
      id: '1', title: '玩什么', active: true, keyword: '投票', createdAt: 0,
      options: [
        { id: '1', text: '王者荣耀', votes: 2 },
        { id: '2', text: '英雄联盟', votes: 1 },
      ],
    };
    render(<VotePanel session={session} onStart={noop} onEnd={noop} onReset={noop} getResults={() => null} />);
    expect(screen.getByText('王者荣耀')).not.toBeNull();
    expect(screen.getByText('2 票')).not.toBeNull();
  });

  it('已结束投票后点击「开始新投票」触发 reset', () => {
    const onReset = vi.fn();
    const session: VoteSession = {
      id: '1', title: '玩什么', active: false, keyword: '投票', createdAt: 0,
      options: [{ id: '1', text: '王者荣耀', votes: 0 }],
    };
    render(<VotePanel session={session} onStart={noop} onEnd={noop} onReset={onReset} getResults={() => null} />);

    expect(screen.getByText('投票已结束')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '开始新投票' }));
    expect(onReset).toHaveBeenCalled();
  });
});

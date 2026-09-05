import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { SearchPanel } from '../SearchPanel';
import { mockCommand } from '../../../test/__mocks__/canvasEditorMock';

vi.mock('@hufe921/canvas-editor', () => ({
  default: vi.fn(),
}));

describe('SearchPanel', () => {
  const mockEditor = { command: mockCommand } as any;
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCommand.getSearchNavigateInfo.mockReturnValue(null);
  });

  it('渲染查找与替换面板', () => {
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    expect(screen.getByPlaceholderText('查找内容')).toBeTruthy();
    expect(screen.getByPlaceholderText('替换为')).toBeTruthy();
    expect(screen.getByText('查找与替换')).toBeTruthy();
  });

  it('输入搜索词调用 executeSearch', () => {
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    const input = screen.getByPlaceholderText('查找内容');
    fireEvent.change(input, { target: { value: '测试' } });
    expect(mockCommand.executeSearch).toHaveBeenCalledWith('测试');
  });

  it('空搜索词调用 executeSearch(null) 清除高亮', () => {
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    const input = screen.getByPlaceholderText('查找内容');
    fireEvent.change(input, { target: { value: '测试' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(mockCommand.executeSearch).toHaveBeenCalledWith(null);
  });

  it('点击关闭按钮清除搜索并调用 onClose', () => {
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    const closeBtn = screen.getByTitle('关闭');
    fireEvent.click(closeBtn);
    expect(mockCommand.executeSearch).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });

  it('点击上一个/下一个调用导航命令', () => {
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('上一个'));
    expect(mockCommand.executeSearchNavigatePre).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('下一个'));
    expect(mockCommand.executeSearchNavigateNext).toHaveBeenCalled();
  });

  it('替换按钮禁用态：无搜索词时 disabled', () => {
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    const replaceBtn = screen.getByText('替换');
    expect(replaceBtn.getAttribute('disabled')).not.toBeNull();
  });

  it('替换按钮在有搜索词时可用', () => {
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('查找内容'), { target: { value: '关键词' } });
    const replaceBtn = screen.getByText('替换');
    expect(replaceBtn.getAttribute('disabled')).toBeNull();
  });

  it('按 Enter 在搜索框中触发导航下一个', () => {
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    const input = screen.getByPlaceholderText('查找内容');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockCommand.executeSearchNavigateNext).toHaveBeenCalled();
  });

  it('全部替换一次性调用 executeReplace（不带 index）并同步计数', async () => {
    mockCommand.getSearchNavigateInfo.mockReturnValue({ index: 0, count: 1 });
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('查找内容'), { target: { value: '关键词' } });
    fireEvent.change(screen.getByPlaceholderText('替换为'), { target: { value: '新词' } });
    fireEvent.click(screen.getByText('全部替换'));
    // 等待 safeSetTimeout 回调执行
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCommand.executeReplace).toHaveBeenCalledTimes(1);
    expect(mockCommand.executeReplace).toHaveBeenCalledWith('新词');
    expect(mockCommand.getSearchNavigateInfo).toHaveBeenCalled();
  });

  it('单处替换按当前匹配下标传 index（1-based 转 0-based）', async () => {
    mockCommand.getSearchNavigateInfo.mockReturnValue({ index: 2, count: 3 });
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('查找内容'), { target: { value: '关键词' } });
    fireEvent.change(screen.getByPlaceholderText('替换为'), { target: { value: '新词' } });
    fireEvent.click(screen.getByText('替换'));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCommand.executeReplace).toHaveBeenCalledWith('新词', { index: 1 });
  });

  it('未导航定位时（index=0）单处替换取首处匹配', async () => {
    mockCommand.getSearchNavigateInfo.mockReturnValue({ index: 0, count: 3 });
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('查找内容'), { target: { value: '关键词' } });
    fireEvent.change(screen.getByPlaceholderText('替换为'), { target: { value: '新词' } });
    fireEvent.click(screen.getByText('替换'));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCommand.executeReplace).toHaveBeenCalledWith('新词', { index: 0 });
  });

  it('StrictMode 双挂载后计数仍能更新（mountedRef 回归测试）', async () => {
    mockCommand.getSearchNavigateInfo.mockReturnValue({ index: 1, count: 2 });
    render(
      <StrictMode>
        <SearchPanel editor={mockEditor} onClose={onClose} />
      </StrictMode>,
    );
    fireEvent.change(screen.getByPlaceholderText('查找内容'), { target: { value: '关键词' } });
    // StrictMode 挂载→清理→重挂载后 mountedRef 必须仍为 true，否则 syncResults 被丢弃
    await waitFor(() => expect(screen.getByText('1/2')).toBeTruthy());
  });

  it('搜索无结果时显示「无结果」', async () => {
    mockCommand.getSearchNavigateInfo.mockReturnValue(null);
    render(<SearchPanel editor={mockEditor} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('查找内容'), { target: { value: '不存在' } });
    await waitFor(() => expect(screen.getByText('无结果')).toBeTruthy());
  });

  it('editor 为 null 时不崩溃', () => {
    render(<SearchPanel editor={null} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('查找内容'), { target: { value: '测试' } });
    // 不应抛出异常
  });
});

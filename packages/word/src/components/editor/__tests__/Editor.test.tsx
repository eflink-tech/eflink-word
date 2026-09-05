import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// 使用 vi.hoisted 确保 mock 函数在 vi.mock 工厂中可用
const { mockExecuteSetValue, mockDestroy, mockGetWordCount, mockEventBusOn, mockEventBusOff } = vi.hoisted(() => ({
  mockExecuteSetValue: vi.fn(),
  mockDestroy: vi.fn(),
  mockGetWordCount: vi.fn().mockResolvedValue(0),
  mockEventBusOn: vi.fn(),
  mockEventBusOff: vi.fn(),
}));

// mock canvas-editor 模块
vi.mock('@hufe921/canvas-editor', () => ({
  default: vi.fn(),
  PaperDirection: { VERTICAL: 0, HORIZONTAL: 1 },
  ElementType: { TEXT: 'text' },
}));

vi.mock('../../../core/canvas-editor/editor-instance', () => ({
  createEditor: vi.fn().mockReturnValue({
    command: { executeSetValue: mockExecuteSetValue, getWordCount: mockGetWordCount },
    eventBus: { on: mockEventBusOn, off: mockEventBusOff },
    destroy: mockDestroy,
  }),
  destroyEditor: vi.fn(),
}));

vi.mock('../../../core/canvas-editor/event-bridge', () => ({
  mountEventBridge: vi.fn().mockReturnValue({ unmount: vi.fn() }),
}));

vi.mock('../../../core/canvas-editor/command-binding', () => ({
  syncPaperSettings: vi.fn(),
  syncWatermark: vi.fn(),
  syncHeaderFooterPageNumber: vi.fn(),
}));

vi.mock('../../../core/canvas-editor/paste-handler', () => ({
  mountPasteHandler: vi.fn(),
}));

vi.mock('../../../store/editorStore', () => {
  const state = {
    editor: null,
    isReady: false,
    setEditor: vi.fn(),
    setIsDirty: vi.fn(),
    setRangeStyle: vi.fn(),
    setCurrentPage: vi.fn(),
    setTotalPages: vi.fn(),
    setPageScale: vi.fn(),
    setWordCount: vi.fn(),
  };
  return {
    useEditorStore: Object.assign(
      vi.fn((selector: (s: typeof state) => unknown) => selector(state)),
      { getState: () => state },
    ),
  };
});

vi.mock('../../../store/documentStore', () => ({
  useDocumentStore: vi.fn(() => ({
    id: 'doc1',
    content: { main: [{ type: 'text', value: '' }] },
  })),
}));

vi.mock('../../../store/uiStore', () => ({
  useUIStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state: Record<string, unknown> = {
      paperSize: { width: 794, height: 1123, label: 'A4' },
      paperDirection: 'vertical',
      margin: { top: 72, right: 72, bottom: 72, left: 72, label: '普通' },
      watermark: null,
      editorPrefs: { fontFamily: 'Microsoft YaHei', fontSize: '16px', lineHeight: '1.5' },
    };
    return selector ? selector(state) : state;
  }),
}));

import { Editor } from '../Editor';

describe('Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染容器 div', () => {
    const { container } = render(<Editor className="test-class" />);
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('test-class');
  });

  it('支持自定义 style', () => {
    const { container } = render(<Editor style={{ width: '100%' }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100%');
  });

  it('无 className 时使用空字符串', () => {
    const { container } = render(<Editor />);
    expect((container.firstChild as HTMLElement).className).toBe('');
  });
});

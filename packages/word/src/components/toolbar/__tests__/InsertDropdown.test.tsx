// InsertDropdown 基础测试：插入菜单中的"分页符"按钮调用 executePageBreak
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsertDropdown } from '../InsertDropdown';
import { useEditorStore } from '../../../store/editorStore';
import {
  mockCommand,
  DEFAULT_RANGE_STYLE,
  MockEditor,
} from '../../../test/__mocks__/canvasEditorMock';
import type { IRangeStyle } from '@hufe921/canvas-editor';

vi.mock('@hufe921/canvas-editor', () => ({
  default: class _MockEditor {
    command = {};
    eventBus = {};
    destroy() {}
  },
  ElementType: {},
}));

// mock 插入辅助 hooks（避免触发真实文件选择/弹窗）
vi.mock('../useInsertActions', () => ({
  useImageInsert: () => ({ open: vi.fn(), input: null }),
  useLinkDialog: () => ({
    openInsert: vi.fn(),
    openEdit: vi.fn(),
    dialog: null,
  }),
}));

vi.mock('../../../store/uiStore', () => ({
  useUIStore: () => ({
    watermark: null,
    setWatermark: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useClickOutside', () => ({
  useClickOutside: vi.fn(),
}));

vi.mock('../../../core/tiptap/extensions/horizontal-rule-style', () => ({
  HR_SEPARATORS: [
    { label: '实线', value: '0,0' },
    { label: '虚线', value: '1,1' },
  ],
}));

vi.mock('../../../core/utils/dateInsert', () => ({
  formatDateInsert: () => '2026-09-03',
}));

function asRange(patch: Partial<IRangeStyle>): IRangeStyle {
  return { ...DEFAULT_RANGE_STYLE, ...patch } as unknown as IRangeStyle;
}

function makeEditor() {
  return new MockEditor();
}

describe('InsertDropdown 分页符', () => {
  beforeEach(() => {
    useEditorStore.setState({
      editor: makeEditor() as unknown as ReturnType<typeof useEditorStore.getState>['editor'],
      rangeStyle: asRange({}),
    });
    vi.clearAllMocks();
  });

  it('点击"插入"展开菜单后，点击"分页符"调用 executePageBreak', () => {
    const editor = useEditorStore.getState().editor;
    render(<InsertDropdown editor={editor} />);

    // 点击"插入"打开菜单
    const insertBtn = screen.getByRole('button', { name: /插入/ });
    fireEvent.click(insertBtn);

    // 点击"分页符"
    const pageBreakBtn = screen.getByRole('button', { name: '分页符' });
    fireEvent.click(pageBreakBtn);

    expect(mockCommand.executePageBreak).toHaveBeenCalled();
  });

  it('点击"表格"调用 executeInsertTable(3, 3)', () => {
    const editor = useEditorStore.getState().editor;
    render(<InsertDropdown editor={editor} />);

    fireEvent.click(screen.getByRole('button', { name: /插入/ }));
    fireEvent.click(screen.getByRole('button', { name: '表格' }));

    expect(mockCommand.executeInsertTable).toHaveBeenCalledWith(3, 3);
  });
});

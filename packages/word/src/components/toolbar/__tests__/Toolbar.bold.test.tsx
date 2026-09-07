// 基础格式按钮（粗体/斜体/删除线/下标/上标/撤销/重做）点击与 active/disabled 态测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '../Toolbar';
import { useEditorStore } from '../../../store/editorStore';
import {
  mockCommand,
  DEFAULT_RANGE_STYLE,
  MockEditor,
} from '../../../test/__mocks__/canvasEditorMock';
import type { IRangeStyle } from '@hufe921/canvas-editor';

// canvas-editor 在 Toolbar 中仅作为 type import，运行时无需模块存在；
// 但若有其他路径间接 import，提供空 mock 兜底
vi.mock('@hufe921/canvas-editor', () => ({
  default: class _MockEditor {
    command = {};
    eventBus = {};
    destroy() {}
  },
  ElementType: {},
  ListType: { UL: 'ul', OL: 'ol' },
  ListStyle: { DISC: 'disc', DECIMAL: 'decimal', CHECKBOX: 'checkbox' },
  TextDecorationStyle: { SOLID: 'solid', DOUBLE: 'double', DASHED: 'dashed', DOTTED: 'dotted', WAVY: 'wavy' },
  // uiStore 顶层用到（Toolbar 订阅 AI 面板开关时引入）
  RowFlex: { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'justify' },
  NumberType: { ARABIC: 'arabic' },
}));

// mock 所有子组件（Task 2.2-2.4 迁移），避免引入 TipTap 依赖
vi.mock('../FontFamilySelect', () => ({ FontFamilySelect: () => null }));
vi.mock('../FontSizeSelect', () => ({ FontSizeSelect: () => null }));
vi.mock('../HeadingSelect', () => ({
  HeadingSelect: () => null,
  readLevelFromRange: () => null,
}));
vi.mock('../LineHeightSelect', () => ({ LineHeightSelect: () => null }));
vi.mock('../UnderlineStyleSelect', () => ({
  UnderlineStyleSelect: () => null,
  readUnderlineStyleFromRange: () => null,
}));
vi.mock('../AlignSelect', () => ({ AlignSelect: () => null }));
vi.mock('../InsertDropdown', () => ({
  InsertDropdown: () => null,
  InsertImageButton: () => null,
}));
vi.mock('../ColorPicker', () => ({ ColorPicker: () => null }));
vi.mock('../ToolbarMenu', () => ({ ToolbarMenu: () => null }));
vi.mock('../ParagraphSettingsModal', () => ({ ParagraphSettingsModal: () => null }));
vi.mock('../toolbarOverflow', () => ({
  computeOverflowBuckets: () => ({ hiddenKeys: new Set<string>(), buckets: [] }),
}));

// mock TipTap 相关依赖（仍被未迁移按钮使用）
vi.mock('../../../core/tiptap/text-style', () => ({ applyTextStyle: vi.fn() }));
vi.mock('../../../hooks/useFormatPainter', () => ({
  useFormatPainter: () => ({
    mode: 'off',
    onPainterClick: vi.fn(),
    onPainterDoubleClick: vi.fn(),
    onPainterMouseDown: vi.fn(),
  }),
}));

function renderToolbar() {
  const editor = useEditorStore.getState().editor;
  return render(<Toolbar editor={editor} />);
}

// 局部覆盖 DEFAULT_RANGE_STYLE，强制转换为 IRangeStyle（测试 mock 数据）
function asRange(patch: Partial<IRangeStyle>): IRangeStyle {
  return { ...DEFAULT_RANGE_STYLE, ...patch } as unknown as IRangeStyle;
}

function makeEditor() {
  const base = new MockEditor();
  // 为未迁移按钮补 TipTap 兼容桩，避免运行时 TypeError
  return Object.assign(base, {
    isActive: () => false,
    can: () => ({ undo: () => true, redo: () => true }),
    chain: () => ({
      focus: () => ({
        run: () => true,
        toggleBold: () => ({ run: () => true }),
        toggleItalic: () => ({ run: () => true }),
        toggleStrike: () => ({ run: () => true }),
        toggleSubscript: () => ({ run: () => true }),
        toggleSuperscript: () => ({ run: () => true }),
        toggleBulletList: () => ({ run: () => true }),
        toggleOrderedList: () => ({ run: () => true }),
        toggleTaskList: () => ({ run: () => true }),
        toggleBlockquote: () => ({ run: () => true }),
        toggleUnderline: () => ({ run: () => true }),
        setParagraph: () => ({ run: () => true }),
        unsetAllMarks: () => ({ unsetLineHeight: () => ({ clearNodes: () => ({ run: () => true }) }) }),
        undo: () => ({ run: () => true }),
        redo: () => ({ run: () => true }),
      }),
    }),
    getAttributes: () => ({}),
  });
}

describe('Toolbar 7 个基础格式按钮', () => {
  beforeEach(() => {
    useEditorStore.setState({
      editor: makeEditor() as unknown as ReturnType<typeof useEditorStore.getState>['editor'],
      rangeStyle: asRange({ undo: true, redo: false }),
    });
    vi.clearAllMocks();
  });

  it('点击"加粗"调用 executeBold，rangeStyle.bold=true 时 aria-pressed 为 true', () => {
    const { rerender } = renderToolbar();
    const btn = screen.getByRole('button', { name: '加粗' });
    fireEvent.click(btn);
    expect(mockCommand.executeBold).toHaveBeenCalled();
    // ToolButton 在 active=false 时不渲染 aria-pressed（值为 undefined）
    expect(btn.getAttribute('aria-pressed')).toBeNull();

    useEditorStore.setState({ rangeStyle: asRange({ bold: true, undo: true, redo: false }) });
    rerender(<Toolbar editor={useEditorStore.getState().editor} />);
    expect(screen.getByRole('button', { name: '加粗' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('点击"倾斜"调用 executeItalic', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: '倾斜' }));
    expect(mockCommand.executeItalic).toHaveBeenCalled();
  });

  it('点击"删除线"调用 executeStrikeout', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: '删除线' }));
    expect(mockCommand.executeStrikeout).toHaveBeenCalled();
  });

  it('点击"下标"调用 executeSubscript，type="subscript" 时 aria-pressed 为 true', () => {
    const { rerender } = renderToolbar();
    const btn = screen.getByRole('button', { name: '下标' });
    fireEvent.click(btn);
    expect(mockCommand.executeSubscript).toHaveBeenCalled();
    expect(btn.getAttribute('aria-pressed')).toBeNull();

    useEditorStore.setState({
      rangeStyle: asRange({ type: 'subscript' as any, undo: true, redo: false }),
    });
    rerender(<Toolbar editor={useEditorStore.getState().editor} />);
    expect(screen.getByRole('button', { name: '下标' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('点击"上标"调用 executeSuperscript，type="superscript" 时 aria-pressed 为 true', () => {
    const { rerender } = renderToolbar();
    const btn = screen.getByRole('button', { name: '上标' });
    fireEvent.click(btn);
    expect(mockCommand.executeSuperscript).toHaveBeenCalled();
    expect(btn.getAttribute('aria-pressed')).toBeNull();

    useEditorStore.setState({
      rangeStyle: asRange({ type: 'superscript' as any, undo: true, redo: false }),
    });
    rerender(<Toolbar editor={useEditorStore.getState().editor} />);
    expect(screen.getByRole('button', { name: '上标' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('撤销按钮：rangeStyle.undo=true 可点击；undo=false 时 disabled', () => {
    const { rerender } = renderToolbar();
    const btn = screen.getByRole('button', { name: '撤销' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(mockCommand.executeUndo).toHaveBeenCalled();

    useEditorStore.setState({ rangeStyle: asRange({ undo: false, redo: false }) });
    rerender(<Toolbar editor={useEditorStore.getState().editor} />);
    expect(screen.getByRole('button', { name: '撤销' })).toBeDisabled();
  });

  it('重做按钮：rangeStyle.redo=false 时 disabled；redo=true 时可点击', () => {
    const { rerender } = renderToolbar();
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled();

    useEditorStore.setState({ rangeStyle: asRange({ redo: true, undo: true }) });
    rerender(<Toolbar editor={useEditorStore.getState().editor} />);
    const btn = screen.getByRole('button', { name: '重做' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(mockCommand.executeRedo).toHaveBeenCalled();
  });
});

// 底纹颜色按钮：与高亮共用 element.highlight，选择颜色应调用 executeHighlight
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
  RowFlex: { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'justify' },
  NumberType: { ARABIC: 'arabic' },
}));

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
vi.mock('../ParagraphSettingsModal', () => ({ ParagraphSettingsModal: () => null }));
vi.mock('../toolbarOverflow', () => ({
  computeOverflowBuckets: () => ({ hiddenKeys: new Set<string>(), buckets: [] }),
}));
vi.mock('../../../hooks/useFormatPainter', () => ({
  useFormatPainter: () => ({
    mode: 'off',
    onPainterClick: vi.fn(),
    onPainterDoubleClick: vi.fn(),
    onPainterMouseDown: vi.fn(),
  }),
}));

function asRange(patch: Partial<IRangeStyle>): IRangeStyle {
  return { ...DEFAULT_RANGE_STYLE, ...patch } as unknown as IRangeStyle;
}

function makeEditor() {
  return new MockEditor() as unknown as ReturnType<typeof useEditorStore.getState>['editor'];
}

describe('Toolbar 底纹颜色', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useEditorStore.setState({
      editor: makeEditor(),
      rangeStyle: asRange({ highlight: '#ffc000', undo: true }),
    });
  });

  it('色条显示当前高亮值，选择颜色调用 executeHighlight', () => {
    render(<Toolbar editor={useEditorStore.getState().editor} />);
    const btn = screen.getByRole('button', { name: '底纹颜色' });
    const bar = btn.querySelector('[data-testid="toolbar-color-bar"]');
    expect(bar).toHaveStyle({ backgroundColor: 'rgb(255, 192, 0)' });

    fireEvent.click(btn);
    const swatch = screen
      .getAllByTestId('theme-color')
      .find((el) => el.getAttribute('title') === '#4472c4');
    expect(swatch).toBeTruthy();
    fireEvent.click(swatch!);

    expect(mockCommand.executeHighlight).toHaveBeenCalledWith('#4472c4');
  });

  it('点击默认调用 executeHighlight(null)', () => {
    render(<Toolbar editor={useEditorStore.getState().editor} />);
    fireEvent.click(screen.getByRole('button', { name: '底纹颜色' }));
    fireEvent.click(screen.getByRole('button', { name: '默认', exact: true }));

    expect(mockCommand.executeHighlight).toHaveBeenCalledWith(null);
  });
});

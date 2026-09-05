// src/test/__mocks__/canvasEditorMock.ts
import { vi } from 'vitest';

export const mockCommand = {
  getValue: vi.fn().mockReturnValue({ data: { main: [] }, version: '1.0', options: {} }),
  executeSetValue: vi.fn(),
  executeBold: vi.fn(),
  executeItalic: vi.fn(),
  executeStrikeout: vi.fn(),
  executeSubscript: vi.fn(),
  executeSuperscript: vi.fn(),
  executeFont: vi.fn(),
  executeSize: vi.fn(),
  executeSizeAdd: vi.fn(),
  executeSizeMinus: vi.fn(),
  executeColor: vi.fn(),
  executeHighlight: vi.fn(),
  executeRowFlex: vi.fn(),
  executeRowMargin: vi.fn(),
  executeImage: vi.fn(),
  executeInsertTable: vi.fn(),
  executeHyperlink: vi.fn(),
  executeSeparator: vi.fn(),
  executePageBreak: vi.fn(),
  executeUndo: vi.fn(),
  executeRedo: vi.fn(),
  executePainter: vi.fn(),
  executeApplyPainterStyle: vi.fn(),
  executeSearch: vi.fn(),
  executeReplace: vi.fn(),
  executeSearchNavigateNext: vi.fn(),
  executeSearchNavigatePre: vi.fn(),
  executePaperSize: vi.fn(),
  executePaperDirection: vi.fn(),
  executeSetPaperMargin: vi.fn(),
  executePageMode: vi.fn(),
  executePageScale: vi.fn(),
  executePageScaleAdd: vi.fn(),
  executePageScaleMinus: vi.fn(),
  executePageScaleRecovery: vi.fn(),
  executeAddWatermark: vi.fn(),
  executeDeleteWatermark: vi.fn(),
  executePrint: vi.fn(),
  executeTitle: vi.fn(),
  executeInsertTitle: vi.fn(),
  executeList: vi.fn(),
  executeLocationCatalog: vi.fn(),
  getCatalog: vi.fn().mockResolvedValue([]),
  getWordCount: vi.fn().mockResolvedValue(0),
  getSearchNavigateInfo: vi.fn().mockReturnValue(null),
  getRange: vi.fn().mockReturnValue({ startIndex: 0, endIndex: 0 }),
  getRangeText: vi.fn().mockReturnValue(''),
  getRangeContext: vi.fn().mockReturnValue(null),
  executeCancelHyperlink: vi.fn(),
  executeFormat: vi.fn(),
  executeInsertElementList: vi.fn(),
  executeUpdateOptions: vi.fn(),
  executeForceUpdate: vi.fn(),
  getHTML: vi.fn().mockReturnValue(''),
  getText: vi.fn().mockReturnValue(''),
  getImage: vi.fn().mockReturnValue(null),
  getOptions: vi.fn().mockReturnValue({ width: 794 }),
};

export const mockEventBus = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

export const mockOverride = {
  paste: undefined as unknown,
  pasteImage: undefined as unknown,
  copy: undefined as unknown,
  drop: undefined as unknown,
};

export const mockEditor = {
  command: mockCommand,
  eventBus: mockEventBus,
  override: mockOverride,
  destroy: vi.fn(),
};

export class MockEditor {
  command = mockCommand;
  eventBus = mockEventBus;
  override = { ...mockOverride };
  destroy = vi.fn();
  constructor() {}
}

export const DEFAULT_RANGE_STYLE = {
  type: null,
  undo: false,
  redo: false,
  painter: false,
  font: 'Microsoft YaHei',
  size: 16,
  bold: false,
  italic: false,
  underline: false,
  strikeout: false,
  color: '#000000',
  highlight: null,
  rowFlex: 'left',
  rowMargin: 1,
  dashArray: [],
  level: 0,
  listType: null,
  listStyle: null,
  groupIds: [],
  textDecoration: null,
};

export const ElementType = {
  TEXT: 'text',
  IMAGE: 'image',
  TABLE: 'table',
  HYPERLINK: 'hyperlink',
  PAGE_BREAK: 'pageBreak',
  SEPARATOR: 'separator',
  TITLE: 'title',
  SUBSCRIPT: 'subscript',
  SUPERSCRIPT: 'superscript',
};

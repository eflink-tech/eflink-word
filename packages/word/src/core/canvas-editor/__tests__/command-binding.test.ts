import { describe, it, expect, vi } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { PaperDirection, RowFlex, NumberType } from '@hufe921/canvas-editor';
import { syncPaperSettings, syncWatermark, syncHeaderFooterPageNumber } from '../command-binding';

/** syncPaperSettings 所需的最小 mock 类型 */
interface MockPaperEditor {
  command: {
    executePaperSize: ReturnType<typeof vi.fn>;
    executePaperDirection: ReturnType<typeof vi.fn>;
    executeSetPaperMargin: ReturnType<typeof vi.fn>;
  };
}

/** syncWatermark 所需的最小 mock 类型 */
interface MockWatermarkEditor {
  command: {
    executeAddWatermark: ReturnType<typeof vi.fn>;
    executeDeleteWatermark: ReturnType<typeof vi.fn>;
  };
}

function createPaperMock(): MockPaperEditor {
  return {
    command: {
      executePaperSize: vi.fn(),
      executePaperDirection: vi.fn(),
      executeSetPaperMargin: vi.fn(),
    },
  };
}

function createWatermarkMock(): MockWatermarkEditor {
  return {
    command: {
      executeAddWatermark: vi.fn(),
      executeDeleteWatermark: vi.fn(),
    },
  };
}

describe('syncPaperSettings', () => {
  it('calls executePaperSize with (width, height)', () => {
    const editor = createPaperMock();
    syncPaperSettings(editor as unknown as Editor, { paperWidth: 794, paperHeight: 1123, paperDirection: PaperDirection.VERTICAL, margin: { top: 96, right: 120, bottom: 96, left: 120 } });
    expect(editor.command.executePaperSize).toHaveBeenCalledWith(794, 1123);
  });

  it('calls executePaperDirection with direction', () => {
    const editor = createPaperMock();
    syncPaperSettings(editor as unknown as Editor, { paperWidth: 794, paperHeight: 1123, paperDirection: PaperDirection.HORIZONTAL, margin: { top: 96, right: 120, bottom: 96, left: 120 } });
    expect(editor.command.executePaperDirection).toHaveBeenCalledWith(PaperDirection.HORIZONTAL);
  });

  it('calls executeSetPaperMargin with array [t,r,b,l]', () => {
    const editor = createPaperMock();
    syncPaperSettings(editor as unknown as Editor, { paperWidth: 794, paperHeight: 1123, paperDirection: PaperDirection.VERTICAL, margin: { top: 96, right: 120, bottom: 96, left: 120 } });
    expect(editor.command.executeSetPaperMargin).toHaveBeenCalledWith([96, 120, 96, 120]);
  });
});

describe('syncWatermark', () => {
  it('adds watermark when text provided', () => {
    const editor = createWatermarkMock();
    syncWatermark(editor as unknown as Editor, '机密');
    expect(editor.command.executeAddWatermark).toHaveBeenCalledWith({ data: '机密' });
    expect(editor.command.executeDeleteWatermark).not.toHaveBeenCalled();
  });

  it('trims whitespace before adding watermark', () => {
    const editor = createWatermarkMock();
    syncWatermark(editor as unknown as Editor, '  机密  ');
    expect(editor.command.executeAddWatermark).toHaveBeenCalledWith({ data: '机密' });
  });

  it('deletes watermark when text is null', () => {
    const editor = createWatermarkMock();
    syncWatermark(editor as unknown as Editor, null);
    expect(editor.command.executeDeleteWatermark).toHaveBeenCalled();
    expect(editor.command.executeAddWatermark).not.toHaveBeenCalled();
  });

  it('deletes watermark when text is empty string', () => {
    const editor = createWatermarkMock();
    syncWatermark(editor as unknown as Editor, '   ');
    expect(editor.command.executeDeleteWatermark).toHaveBeenCalled();
  });
});

describe('syncHeaderFooterPageNumber', () => {
  const baseConfig = {
    header: {
      enabled: false,
      content: '',
      fontSize: 12,
      font: 'Microsoft YaHei',
      color: '#8f959e',
      rowFlex: RowFlex.CENTER,
    },
    footer: {
      enabled: false,
      content: '',
      fontSize: 12,
      font: 'Microsoft YaHei',
      color: '#8f959e',
      rowFlex: RowFlex.CENTER,
    },
    pageNumber: {
      enabled: true,
      format: '第{pageNo}页/共{pageCount}页',
      size: 12,
      font: 'Microsoft YaHei',
      color: '#8f959e',
      rowFlex: RowFlex.CENTER,
      numberType: NumberType.ARABIC,
      startPageNo: 1,
      fromPageNo: 0,
    },
  };

  it('mutates options in place and avoids executeUpdateOptions (preserves paperDirection)', () => {
    const options = {
      paperDirection: PaperDirection.HORIZONTAL,
      header: { disabled: false, editable: true },
      footer: { disabled: false, editable: true },
      pageNumber: { disabled: true, startPageNo: 0, fromPageNo: 0 },
    };
    const editor = {
      command: {
        getOptions: vi.fn(() => options),
        executeUpdateOptions: vi.fn(),
        executeForceUpdate: vi.fn(),
        getValue: vi.fn(() => ({ main: [] })),
        executeSetValue: vi.fn(),
      },
    };

    syncHeaderFooterPageNumber(editor as unknown as Editor, baseConfig);

    expect(editor.command.executeUpdateOptions).not.toHaveBeenCalled();
    expect(options.paperDirection).toBe(PaperDirection.HORIZONTAL);
    expect(options.pageNumber).toMatchObject({
      disabled: false,
      startPageNo: 1,
      fromPageNo: 0,
    });
    expect(editor.command.executeForceUpdate).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { PageMode, PaperDirection } from '@hufe921/canvas-editor';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

const pdfSave = vi.fn();
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function MockJsPDF() {
    return {
      addPage: vi.fn(),
      addImage: vi.fn(),
      save: pdfSave,
    };
  }),
}));

import {
  exportEfword,
  exportPdf,
  importEfword,
  buildEfwordFilename,
  EFWORD_FORMAT,
  EFWORD_APP_NAME,
  EFWORD_SOURCE_URL,
} from '../exportImport';
import { saveAs } from 'file-saver';

function makeEditor(opts: {
  data?: Record<string, unknown>;
  pageImages?: string[];
} = {}): Editor {
  const editor = {
    command: {
      getValue: vi.fn(() => ({
        data: opts.data ?? { main: [{ value: 'hello' }] },
      })),
      executeSetValue: vi.fn(),
      getOptions: vi.fn(() => ({
        width: 794,
        height: 1123,
        paperDirection: PaperDirection.VERTICAL,
        printPixelRatio: 2,
        scale: 1,
        pageMode: PageMode.PAGING,
      })),
      getImage: vi.fn(async () => opts.pageImages ?? ['data:image/png;base64,abc']),
      executePageMode: vi.fn(),
      executePageScale: vi.fn(),
    },
  } as unknown as Editor;
  return editor;
}

describe('exportImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildEfwordFilename', () => {
    it('生成 xxx.efword 文件名', () => {
      expect(buildEfwordFilename('测试文档')).toBe('测试文档.efword');
    });

    it('过滤非法文件名字符', () => {
      expect(buildEfwordFilename('a/b:c')).toBe('a_b_c.efword');
    });
  });

  describe('exportEfword', () => {
    it('导出 .efword 并包含来源信息', async () => {
      const editor = makeEditor();
      await exportEfword(editor, 'test');
      expect(editor.command.getValue).toHaveBeenCalled();
      expect(saveAs).toHaveBeenCalled();
      const [blob, filename] = (saveAs as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(filename).toBe('test.efword');
      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed.format).toBe(EFWORD_FORMAT);
      expect(parsed.title).toBe('test');
      expect(parsed.data.main).toEqual([{ value: 'hello' }]);
      expect(parsed.source).toEqual({
        app: EFWORD_APP_NAME,
        url: EFWORD_SOURCE_URL,
      });
    });

    it('默认文件名为未命名文档.efword', async () => {
      const editor = makeEditor();
      await exportEfword(editor);
      const [, filename] = (saveAs as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(filename).toBe('未命名文档.efword');
    });
  });

  describe('importEfword', () => {
    it('解析 efword 包装格式并写入编辑器', async () => {
      const editor = makeEditor();
      const payload = {
        format: EFWORD_FORMAT,
        version: '1.0',
        exportedAt: new Date().toISOString(),
        title: 't',
        source: {
          app: EFWORD_APP_NAME,
          url: EFWORD_SOURCE_URL,
        },
        data: { main: [{ value: 'hi' }] },
      };
      const file = new File([JSON.stringify(payload)], 'a.efword', {
        type: 'application/json',
      });
      await importEfword(editor, file);
      expect(editor.command.executeSetValue).toHaveBeenCalledWith({ main: [{ value: 'hi' }] });
    });

    it('兼容纯 canvas-editor JSON', async () => {
      const editor = makeEditor();
      const file = new File([JSON.stringify({ main: [{ value: 'raw' }] })], 'legacy.json', {
        type: 'application/json',
      });
      await importEfword(editor, file);
      expect(editor.command.executeSetValue).toHaveBeenCalledWith({ main: [{ value: 'raw' }] });
    });

    it('无效 JSON 抛错', async () => {
      const editor = makeEditor();
      const file = new File(['not-json'], 'bad.efword', { type: 'application/json' });
      await expect(importEfword(editor, file)).rejects.toThrow('文件格式无效');
    });

    it('空文档抛错', async () => {
      const editor = makeEditor();
      const file = new File(
        [JSON.stringify({ format: EFWORD_FORMAT, data: { main: [] } })],
        'empty.efword',
        { type: 'application/json' },
      );
      await expect(importEfword(editor, file)).rejects.toThrow('文档内容为空');
    });
  });

  describe('exportPdf', () => {
    it('渲染打印模式页面并保存 PDF', async () => {
      const editor = makeEditor({ pageImages: ['data:image/png;base64,abc', 'data:image/png;base64,def'] });
      await exportPdf(editor, 'my-doc');
      expect(editor.command.getImage).toHaveBeenCalledWith({
        pixelRatio: 2,
        mode: 'print',
      });
      expect(pdfSave).toHaveBeenCalledWith('my-doc.pdf');
    });

    it('无页面时抛错', async () => {
      const editor = makeEditor({ pageImages: [] });
      await expect(exportPdf(editor, 'empty')).rejects.toThrow('文档为空');
    });
  });
});

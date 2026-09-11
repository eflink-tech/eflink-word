import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
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
  exportImage,
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
  scale?: number;
  pageMode?: PageMode;
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
        scale: opts.scale ?? 1,
        pageMode: opts.pageMode ?? PageMode.PAGING,
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

  describe('exportImage', () => {
    /** jsdom 不支持图片解码与 canvas 渲染：用可断言的假 Image / canvas 替身 */
    function stubBrowserAssets(canvasSize: { width: number; height: number }) {
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        naturalWidth = 794;
        naturalHeight = 1123;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      }

      const ctx = {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      };
      const canvas = {
        width: canvasSize.width,
        height: canvasSize.height,
        getContext: vi.fn(() => ctx),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
          callback(new Blob(['png'], { type: 'image/png' }));
        }),
      };

      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockImplementation(((tag: string) =>
          tag === 'canvas'
            ? (canvas as unknown as HTMLCanvasElement)
            : originalCreateElement(tag)) as typeof document.createElement);

      vi.stubGlobal('Image', MockImage);

      return {
        ctx,
        canvas,
        restore: () => {
          createElementSpy.mockRestore();
          vi.unstubAllGlobals();
        },
      };
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('单页直接下载该页 PNG，渲染参数与导出 PDF 一致', async () => {
      const editor = makeEditor({ pageImages: ['data:image/png;base64,abc'] });
      await exportImage(editor, 'my-doc');
      expect(editor.command.getImage).toHaveBeenCalledWith({ pixelRatio: 2, mode: 'print' });
      expect(saveAs).toHaveBeenCalledTimes(1);
      const [blob, filename] = (saveAs as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(filename).toBe('my-doc.png');
    });

    it('多页纵向拼接为一张白底长图', async () => {
      const stub = stubBrowserAssets({ width: 0, height: 0 });
      const editor = makeEditor({
        pageImages: [
          'data:image/png;base64,page1',
          'data:image/png;base64,page2',
          'data:image/png;base64,page3',
        ],
      });

      await exportImage(editor, 'long-doc');

      expect(stub.canvas.width).toBe(794);
      expect(stub.canvas.height).toBe(3369);
      expect(stub.ctx.fillStyle).toBe('#ffffff');
      expect(stub.ctx.fillRect).toHaveBeenCalledWith(0, 0, 794, 3369);
      expect(stub.ctx.drawImage.mock.calls.map((call) => call.slice(1))).toEqual([
        [0, 0, 794, 1123],
        [0, 1123, 794, 1123],
        [0, 2246, 794, 1123],
      ]);
      const [blob, filename] = (saveAs as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(filename).toBe('long-doc.png');
    });

    it('长图超出浏览器 canvas 上限时等比缩小', async () => {
      const stub = stubBrowserAssets({ width: 0, height: 0 });
      // 15 页 × 1123px = 16845px > 16384px（Chrome canvas 单边上限）
      const editor = makeEditor({
        pageImages: Array.from({ length: 15 }, (_, i) => `data:image/png;base64,p${i}`),
      });

      await exportImage(editor, 'huge-doc');

      expect(stub.canvas.width).toBe(772);
      expect(stub.canvas.height).toBe(16384);
    });

    it('无页面时抛错', async () => {
      const editor = makeEditor({ pageImages: [] });
      await expect(exportImage(editor, 'empty')).rejects.toThrow('文档为空');
    });

    it('导出前后恢复 pageMode / pageScale', async () => {
      stubBrowserAssets({ width: 0, height: 0 });
      const editor = makeEditor({
        pageImages: ['data:image/png;base64,abc', 'data:image/png;base64,def'],
        scale: 1.5,
        pageMode: PageMode.CONTINUITY,
      });

      await exportImage(editor, 'my-doc');

      const command = editor.command as unknown as {
        executePageMode: ReturnType<typeof vi.fn>;
        executePageScale: ReturnType<typeof vi.fn>;
      };
      expect(command.executePageMode.mock.calls).toEqual([
        [PageMode.PAGING],
        [PageMode.CONTINUITY],
      ]);
      expect(command.executePageScale.mock.calls).toEqual([[1], [1.5]]);
    });
  });
});

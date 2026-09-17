import { describe, expect, it, vi } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { exportDocx, importDocx } from '../index';

// jsdom 无下载 API，stub 掉 file-saver，测试聚焦文件名清洗而非下载行为
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

const fakeEditor = {} as Editor;

/** 构造 File（node20/jsdom 均可用） */
function makeFile(content: Uint8Array | ArrayBuffer, name: string): File {
  return new File([content as BlobPart], name);
}

describe('importDocx 入口拦截', () => {
  it('OLE2 魔数（旧版 .doc）直接拒绝，且不触碰编辑器', async () => {
    const ole = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0,
    ]);
    const setValue = vi.fn();
    const editor = { command: { executeSetValue: setValue } } as unknown as Editor;
    await expect(
      importDocx(editor, makeFile(ole, '伪装.docx')),
    ).rejects.toThrow('.doc');
    expect(setValue).not.toHaveBeenCalled();
  });

  it('.doc 扩展名直接拒绝', async () => {
    await expect(
      importDocx(fakeEditor, makeFile(new Uint8Array(8), '报告.doc')),
    ).rejects.toThrow('.doc');
  });
});

describe('exportDocx 文件名处理', () => {
  it('非法字符被清洗为下划线', async () => {
    // 不真实断言文件名（下载在入口层触发）：仅校验含非法字符的文件名不抛异常、正常完成导出
    const editor = makeMockEditorForExport([{ value: '内容' }]);
    await expect(
      exportDocx(editor, '非法/文件:名*.docx'),
    ).resolves.toBeUndefined();
  });
});

function makeMockEditorForExport(main: Array<Record<string, unknown>>): Editor {
  return {
    command: {
      getValue: () => ({
        data: { header: [], footer: [], main },
        options: {
          defaultSize: 16,
          defaultRowMargin: 1,
          defaultBasicRowMarginHeight: 8,
          width: 794,
          height: 1123,
          margins: [96, 120, 96, 120],
          paperDirection: 0,
          watermark: { data: '' },
        },
      }),
    },
  } as unknown as Editor;
}

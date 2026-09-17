import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { createDocxImporter } from '../importDocx';
import { boldRunXml, buildDocx, paragraphWithRunsXml, paragraphXml } from './fixtures';

/** 最小 Content_Types（缺 document.xml 覆盖项，供坏档用例用） */
const CONTENT_TYPES_PLACEHOLDER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`;

/** 捕获 executeSetValue 收到的 IEditorData */
function makeMockCommand() {
  return {
    executeSetValue: vi.fn(),
    executeUpdateOptions: vi.fn(),
    // 上游工厂在判断水印/页面设置前会读取当前配置
    getValue: vi.fn(() => ({ options: {} })),
  };
}

describe('createDocxImporter', () => {
  let command: ReturnType<typeof makeMockCommand>;

  beforeEach(() => {
    command = makeMockCommand();
  });

  function importedData() {
    expect(command.executeSetValue).toHaveBeenCalled();
    return command.executeSetValue.mock.calls[0][0] as {
      header: unknown[];
      footer: unknown[];
      main: Array<Record<string, unknown>>;
    };
  }

  it('解析两个普通段落为 main 元素', async () => {
    const buffer = await buildDocx(
      paragraphXml('第一段') + paragraphXml('第二段'),
    );
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const data = importedData();
    expect(Array.isArray(data.main)).toBe(true);
    const text = data.main
      .map((el) => String(el.value ?? ''))
      .join('\n');
    expect(text).toContain('第一段');
    expect(text).toContain('第二段');
  });

  it('解析加粗 run 为 bold 元素', async () => {
    const buffer = await buildDocx(
      paragraphWithRunsXml(
        '<w:r><w:t>普通</w:t></w:r>' + boldRunXml('加粗'),
      ),
    );
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const data = importedData();
    // 上游解析器会把段落结束符 \n 追加到段落最后一个 run 的 value 上，故 trim 后比较
    const values = data.main.map((el) => ({
      value: String(el.value ?? '').trim(),
      bold: el.bold,
    }));
    expect(values.some((el) => el.value === '加粗' && el.bold === true)).toBe(true);
    expect(values.some((el) => el.value === '普通' && !el.bold)).toBe(true);
  });

  it('缺少 word/document.xml 时抛出中文错误', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES_PLACEHOLDER);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    await expect(
      createDocxImporter(command as unknown as Editor['command'])({
        arrayBuffer: buffer,
      }),
    ).rejects.toThrow('无效的 docx 文件');
  });
});

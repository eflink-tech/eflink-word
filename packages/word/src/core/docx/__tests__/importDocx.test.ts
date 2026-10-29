import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { createDocxImporter } from '../importDocx';
import {
  boldRunXml,
  buildDocx,
  buildDocxPackage,
  paragraphWithRunsXml,
  paragraphXml,
} from './fixtures';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** 收集元素树中的全部文本（含列表/表格/控件） */
function collectText(elements: unknown[] | undefined): string {
  let text = '';
  for (const raw of elements || []) {
    const el = raw as Record<string, any>;
    if (el.type === 'table') {
      for (const tr of el.trList || []) {
        for (const td of tr.tdList || []) text += collectText(td.value);
      }
      continue;
    }
    if (el.valueList) text += collectText(el.valueList);
    if (el.control?.value) text += collectText(el.control.value);
    if (typeof el.value === 'string') text += el.value;
  }
  return text;
}

function mainText(data: { main: unknown[] }): string {
  return collectText(data.main);
}

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

  it('解析主题色/主题字体、标题样式与段落缩进', async () => {
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia"/><w:sz w:val="24"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Body"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLineChars="200"/><w:jc w:val="center"/></w:pPr></w:style>
</w:styles>`;
    const theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements>
  <a:clrScheme name="T"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1></a:clrScheme>
  <a:fontScheme name="F"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface="等线 Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface="等线"/></a:minorFont></a:fontScheme>
</a:themeElements></a:theme>`;
    const body =
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:color w:themeColor="accent1"/></w:rPr><w:t>标题</w:t></w:r></w:p>` +
      `<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr><w:r><w:rPr><w:color w:themeColor="accent1" w:themeTint="99"/><w:u w:val="double"/></w:rPr><w:t>正文</w:t></w:r></w:p>`;
    const buffer = await buildDocxPackage({
      body,
      wordFiles: { 'styles.xml': styles, 'theme/theme1.xml': theme },
    });
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const data = importedData();
    const title = data.main[0] as Record<string, any>;
    expect(title.type).toBe('title');
    expect(title.level).toBe('first');
    const titleRun = title.valueList[0] as Record<string, any>;
    expect(titleRun.color).toBe('#4472C4');
    expect(titleRun.font).toBe('等线');

    // 标题元素后会自动补一个换行元素，正文在 index 2
    const paragraph = data.main[2] as Record<string, any>;
    expect(paragraph.value.startsWith('\u3000\u3000正文')).toBe(true);
    expect(paragraph.rowFlex).toBe('center');
    expect(paragraph.underline).toBe(true);
    expect((paragraph.textDecoration as { style: string }).style).toBe('double');
    expect(paragraph.color).not.toBe('#4472C4');
    expect(paragraph.color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('修订：保留插入与移动、跳过删除', async () => {
    const body =
      `<w:p><w:r><w:t>保留</w:t></w:r>` +
      `<w:del><w:r><w:delText>删除</w:delText></w:r></w:del>` +
      `<w:ins><w:r><w:t>插入</w:t></w:r></w:ins>` +
      `<w:moveTo><w:r><w:t>移动</w:t></w:r></w:moveTo></w:p>` +
      `<w:del><w:p><w:r><w:delText>整段删除</w:delText></w:r></w:p></w:del>`;
    const buffer = await buildDocx(body);
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const text = mainText(importedData());
    expect(text).toContain('保留插入移动');
    expect(text).not.toContain('删除');
  });

  it('脚注：内联上标与文末注释区', async () => {
    const footnotes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="${W}">
  <w:footnote w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:id="1"><w:p><w:r><w:t>注释内容</w:t></w:r></w:p></w:footnote>
</w:footnotes>`;
    const body =
      `<w:p><w:r><w:t>正文</w:t></w:r>` +
      `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="1"/></w:r></w:p>`;
    const buffer = await buildDocxPackage({
      body,
      wordFiles: { 'footnotes.xml': footnotes },
    });
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const data = importedData();
    const superscript = data.main.find(
      (el) => el.type === 'superscript' && el.value === '[1]',
    );
    expect(superscript).toBeTruthy();
    const text = mainText(data);
    expect(text).toContain('脚注');
    expect(text).toContain('注释内容');
  });

  it('页脚页码域转为 pageNumber 配置', async () => {
    const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="${W}"><w:p><w:r><w:t>页眉</w:t></w:r></w:p></w:hdr>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${W}"><w:p><w:r><w:t>第 </w:t></w:r>` +
      `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>` +
      `<w:r><w:t> 页</w:t></w:r></w:p></w:ftr>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;
    const body =
      paragraphXml('正文') +
      `<w:sectPr><w:headerReference w:type="default" r:id="rId5"/><w:footerReference w:type="default" r:id="rId6"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800"/></w:sectPr>`;
    const buffer = await buildDocxPackage({
      body,
      wordFiles: { 'header1.xml': header, 'footer1.xml': footer },
      documentRels: rels,
    });
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const data = importedData();
    expect(collectText(data.header)).toContain('页眉');
    // 页码行由 pageNumber 渲染，不再作为页脚文本重复输出
    expect(collectText(data.footer).trim()).toBe('');
    const options = command.executeUpdateOptions.mock.calls[0][0] as {
      pageNumber?: { format?: string; disabled?: boolean };
    };
    expect(options.pageNumber?.format).toBe('第 {pageNo} 页');
    expect(options.pageNumber?.disabled).toBe(false);
  });

  it('文本框：AlternateContent 只取 Choice 一次', async () => {
    const txbx = `<w:txbxContent><w:p><w:r><w:t>框内文字</w:t></w:r></w:p></w:txbxContent>`;
    const body = `<w:p><w:r><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">` +
      `<mc:Choice Requires="wps"><w:drawing><w:anchor><wps:txbx xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">${txbx}</wps:txbx></w:anchor></w:drawing></mc:Choice>` +
      `<mc:Fallback><w:pict><v:textbox xmlns:v="urn:schemas-microsoft-com:vml">${txbx}</v:textbox></w:pict></mc:Fallback>` +
      `</mc:AlternateContent></w:r></w:p>`;
    const buffer = await buildDocx(body);
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const text = mainText(importedData());
    expect(text.split('框内文字').length - 1).toBe(1);
  });

  it('HYPERLINK 域转换为超链接', async () => {
    const body =
      `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r><w:instrText> HYPERLINK "https://example.com" </w:instrText></w:r>` +
      `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
      `<w:r><w:t>链接</w:t></w:r>` +
      `<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
    const buffer = await buildDocx(body);
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const link = importedData().main.find((el) => el.type === 'hyperlink');
    expect(link?.url).toBe('https://example.com');
    expect(collectText((link?.valueList as unknown[]) || [])).toContain('链接');
  });

  it('表格边框：统一边框与混合边框', async () => {
    const allBorders =
      `<w:tblPr><w:tblBorders><w:top w:val="single"/><w:left w:val="single"/><w:bottom w:val="single"/><w:right w:val="single"/><w:insideH w:val="single"/><w:insideV w:val="single"/></w:tblBorders></w:tblPr>`;
    const mixedBorders =
      `<w:tblPr><w:tblBorders><w:top w:val="single"/><w:left w:val="single"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="single"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>`;
    const grid =
      `<w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid>`;
    const row = `<w:tr><w:tc><w:p><w:r><w:t>甲</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>乙</w:t></w:r></w:p></w:tc></w:tr>`;
    const buffer = await buildDocx(
      `<w:tbl>${allBorders}${grid}${row}${row}</w:tbl>` +
        `<w:tbl>${mixedBorders}${grid}${row}</w:tbl>`,
    );
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const tables = importedData().main.filter((el) => el.type === 'table') as any[];
    expect(tables[0].borderType).toBe('all');
    expect(tables[1].borderType).toBe('empty');
    const firstRow = tables[1].trList[0].tdList;
    expect(firstRow[0].borderTypes).toEqual(['top', 'left']);
    expect(firstRow[1].borderTypes).toEqual(['top']);
  });

  it('隐藏文本不导入，caps 转大写', async () => {
    const body = paragraphWithRunsXml(
      '<w:r><w:rPr><w:vanish/></w:rPr><w:t>隐藏</w:t></w:r>',
      '<w:r><w:rPr><w:caps/></w:rPr><w:t>abc</w:t></w:r>',
    );
    const buffer = await buildDocx(body);
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const text = mainText(importedData());
    expect(text).not.toContain('隐藏');
    expect(text).toContain('ABC');
  });

  it('编号：项目符号样式与 numFmt=none', async () => {
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W}">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="§"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="2">
    <w:lvl w:ilvl="0"><w:numFmt w:val="none"/><w:lvlText w:val=""/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;
    const body =
      `<w:p><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>项目</w:t></w:r></w:p>` +
      `<w:p><w:pPr><w:numPr><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>无编号</w:t></w:r></w:p>`;
    const buffer = await buildDocxPackage({
      body,
      wordFiles: { 'numbering.xml': numbering },
    });
    await createDocxImporter(command as unknown as Editor['command'])({
      arrayBuffer: buffer,
    });

    const data = importedData();
    const list = data.main.find((el) => el.type === 'list') as Record<string, any>;
    expect(list.listStyle).toBe('square');
    expect(mainText(data)).toContain('无编号');
    expect(data.main.filter((el) => el.type === 'list').length).toBe(1);
  });

  it('缺少 word/document.xml 时抛出无效文件错误', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES_PLACEHOLDER);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    await expect(
      createDocxImporter(command as unknown as Editor['command'])({
        arrayBuffer: buffer,
      }),
    ).rejects.toMatchObject({ code: 'word.error.docxInvalid' });
  });
});

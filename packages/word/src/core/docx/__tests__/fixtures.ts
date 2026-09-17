import JSZip from 'jszip';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const STYLES = `${XML_DECL}<w:styles xmlns:w="${W_NS}"/>`;

function documentXml(body: string): string {
  return `${XML_DECL}<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;
}

/** 普通文本 run；rPrInner 为空时不输出 rPr */
function runXml(text: string, rPrInner = ''): string {
  const rPr = rPrInner ? `<w:rPr>${rPrInner}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

export function paragraphXml(text: string): string {
  return `<w:p>${runXml(text)}</w:p>`;
}

export function paragraphWithRunsXml(...runs: string[]): string {
  return `<w:p>${runs.join('')}</w:p>`;
}

export function boldRunXml(text: string): string {
  return runXml(text, '<w:b/>');
}

/** 组装最小可解析 docx，返回 ArrayBuffer */
export async function buildDocx(body: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.folder('_rels')!.file('.rels', ROOT_RELS);
  const word = zip.folder('word')!;
  word.file('document.xml', documentXml(body));
  word.file('styles.xml', STYLES);
  return zip.generateAsync({ type: 'arraybuffer' });
}

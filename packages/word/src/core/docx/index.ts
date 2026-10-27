// docx 导入导出统一入口
// - 动态 import 收编模块：docx / jszip 进入独立 chunk，不进组件库主包
// - 旧版 .doc（OLE2 复合文档）在入口层拦截，给出中文引导
import { saveAs } from 'file-saver';
import type Editor from '@hufe921/canvas-editor';
import { OfficeError, isOfficeError } from '@eflink-tech/office-kit';
import { sanitizeExportBasename } from '../utils/exportImport';
import { wordT } from '../../i18n/runtime';

/** OLE2（CFB 复合文档）魔数，即旧版 .doc / .xls / .ppt 的文件头 */
const OLE_SIGNATURE: readonly number[] = [
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
];

function isLegacyDocBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 8) {
    return false;
  }
  const head = new Uint8Array(buffer, 0, 8);
  return OLE_SIGNATURE.every((byte, index) => head[index] === byte);
}

function assertNotLegacyDoc(file: File, buffer: ArrayBuffer): void {
  const looksLegacyByName = /\.doc$/i.test(file.name);
  if (looksLegacyByName || isLegacyDocBuffer(buffer)) {
    throw new OfficeError('word.error.docxLegacy', 'legacy .doc is not supported');
  }
}

/** 导入文件大小上限：解析全程在内存中进行（arrayBuffer + JSZip + DOMParser），防止超大文档压垮标签页 */
const MAX_IMPORT_SIZE = 100 * 1024 * 1024;

/**
 * 导入 docx：解析并覆盖当前文档内容
 * @throws 旧版 .doc 格式、非标准 docx 结构时抛出 OfficeError（code 为 i18n key）
 */
export async function importDocx(editor: Editor, file: File): Promise<void> {
  if (file.size > MAX_IMPORT_SIZE) {
    throw new OfficeError('word.error.docxTooLarge', 'docx exceeds 100MB');
  }
  const arrayBuffer = await file.arrayBuffer();
  assertNotLegacyDoc(file, arrayBuffer);
  const { createDocxImporter } = await import('./importDocx');
  try {
    // 必须 await：否则解析失败变成 unhandled rejection，UI 层 catch 接不到，用户看到静默失败
    await createDocxImporter(editor.command)({ arrayBuffer });
  } catch (error) {
    // 收编代码已抛可本地化错误时原样透传；其余（JSZip 非法 zip 等）兜底为通用提示
    if (isOfficeError(error)) {
      throw error;
    }
    throw new OfficeError('word.error.docxCorrupted', 'invalid docx archive');
  }
}

/** 导出 docx 并触发浏览器下载 */
export async function exportDocx(editor: Editor, filename = wordT('word.status.unnamed')): Promise<void> {
  const title = sanitizeExportBasename(filename);
  const { createDocxExporter } = await import('./exportDocx');
  const blob = await createDocxExporter(editor)({ fileName: title });
  saveAs(blob, `${title}.docx`);
}

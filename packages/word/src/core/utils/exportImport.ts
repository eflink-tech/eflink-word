// 文档导出/导入
// - .efword：canvas-editor 原生数据 + 元信息，100% 可还原
// - PDF：canvas 打印模式渲染，与屏显/打印预览一致
// - 图片：复用 PDF 的打印渲染管线，单页直下 PNG，多页纵向拼成一张长图
import type Editor from '@hufe921/canvas-editor';
import { EditorMode, PageMode, PaperDirection } from '@hufe921/canvas-editor';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';

export const EFWORD_FORMAT = 'efword' as const;
export const EFWORD_VERSION = '1.0';
export const EFWORD_EXTENSION = '.efword';
export const EFWORD_APP_NAME = '易飞文档';
export const EFWORD_SOURCE_URL = 'https://eflink.tech/office/word';

/** 导出文件中的来源信息（便于识别文档出处） */
export interface EfwordSource {
  app: string;
  url: string;
}

export interface EfwordFile {
  format: typeof EFWORD_FORMAT;
  version: string;
  exportedAt: string;
  title: string;
  /** 来源网站与应用信息 */
  source: EfwordSource;
  data: Record<string, unknown>;
}

export function buildEfwordSource(): EfwordSource {
  return {
    app: EFWORD_APP_NAME,
    url: EFWORD_SOURCE_URL,
  };
}

export function sanitizeExportBasename(name: string): string {
  const trimmed = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return trimmed || '未命名文档';
}

export function buildEfwordFilename(title: string): string {
  return `${sanitizeExportBasename(title)}${EFWORD_EXTENSION}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEfwordFile(value: unknown): value is EfwordFile {
  return (
    isRecord(value) &&
    value.format === EFWORD_FORMAT &&
    isRecord(value.data) &&
    Array.isArray(value.data.main)
  );
}

function isRawEditorData(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Array.isArray(value.main);
}

function parseImportPayload(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('文件格式无效，请选择 .efword 文件');
  }

  if (isEfwordFile(parsed)) {
    return parsed.data;
  }
  if (isRawEditorData(parsed)) {
    return parsed;
  }
  throw new Error('无法识别的文档格式，请使用 .efword 文件');
}

/** exportEfword 可选项 */
export interface ExportEfwordOptions {
  /** 来源信息覆盖（嵌入宿主时可标识自己的应用）；缺省为易飞文档 */
  source?: EfwordSource;
}

/**
 * 导出为 .efword（canvas-editor 原生格式，可完整还原）
 */
export async function exportEfword(
  editor: Editor,
  filename = '未命名文档',
  options: ExportEfwordOptions = {},
): Promise<void> {
  const title = sanitizeExportBasename(filename);
  const { data } = editor.command.getValue();
  const payload: EfwordFile = {
    format: EFWORD_FORMAT,
    version: EFWORD_VERSION,
    exportedAt: new Date().toISOString(),
    title,
    source: options.source ?? buildEfwordSource(),
    data: data as unknown as Record<string, unknown>,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  saveAs(blob, buildEfwordFilename(title));
}

/**
 * 从 .efword 导入（兼容纯 canvas-editor JSON）
 */
export async function importEfword(editor: Editor, file: File): Promise<void> {
  const text = await file.text();
  const raw = parseImportPayload(text);
  if (Array.isArray(raw.main) && raw.main.length === 0) {
    const hasHeader = Array.isArray(raw.header) && raw.header.length > 0;
    const hasFooter = Array.isArray(raw.footer) && raw.footer.length > 0;
    if (!hasHeader && !hasFooter) {
      throw new Error('文档内容为空，无法导入');
    }
  }
  editor.command.executeSetValue(raw);
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * 导出 PDF（与打印预览一致的 canvas 渲染）
 */
export async function exportPdf(editor: Editor, filename = '未命名文档'): Promise<void> {
  const options = editor.command.getOptions();
  const { width, height, paperDirection, printPixelRatio, scale, pageMode } = options;
  const isLandscape = paperDirection === PaperDirection.HORIZONTAL;
  const pageWidth = isLandscape ? height : width;
  const pageHeight = isLandscape ? width : height;

  const wasPaging = pageMode === PageMode.PAGING;
  if (!wasPaging) {
    editor.command.executePageMode(PageMode.PAGING);
  }

  const previousScale = scale;
  if (previousScale !== 1) {
    editor.command.executePageScale(1);
  }

  try {
    await yieldToMain();
    const pages = await editor.command.getImage({
      pixelRatio: printPixelRatio ?? 3,
      mode: EditorMode.PRINT,
    });

    if (!pages.length) {
      throw new Error('文档为空，无法导出 PDF');
    }

    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'px',
      format: [pageWidth, pageHeight],
      hotfixes: ['px_scaling'],
    });

    for (let index = 0; index < pages.length; index += 1) {
      if (index > 0) {
        pdf.addPage([pageWidth, pageHeight], isLandscape ? 'landscape' : 'portrait');
      }
      pdf.addImage(pages[index], 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      await yieldToMain();
    }

    pdf.save(`${sanitizeExportBasename(filename)}.pdf`);
  } finally {
    if (previousScale !== 1) {
      editor.command.executePageScale(previousScale);
    }
    if (!wasPaging) {
      editor.command.executePageMode(pageMode);
    }
  }
}

/** 浏览器 canvas 安全上限（对齐 Chrome）：单边 16384px、总面积 2^28 px */
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = 268435456;

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('页面图片加载失败，无法导出图片'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('图片生成失败，请重试'));
      }
    }, 'image/png');
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /^data:([^;]+)/.exec(head)?.[1] || 'image/png';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * 导出图片：复用导出 PDF 的打印渲染管线
 * - 单页：直接下载该页 PNG
 * - 多页：纵向拼接为一张白底长图（超出浏览器 canvas 上限时等比缩小）
 */
export async function exportImage(editor: Editor, filename = '未命名文档'): Promise<void> {
  const options = editor.command.getOptions();
  const { printPixelRatio, scale, pageMode } = options;

  const wasPaging = pageMode === PageMode.PAGING;
  if (!wasPaging) {
    editor.command.executePageMode(PageMode.PAGING);
  }

  const previousScale = scale;
  if (previousScale !== 1) {
    editor.command.executePageScale(1);
  }

  try {
    await yieldToMain();
    const pages = await editor.command.getImage({
      pixelRatio: printPixelRatio ?? 3,
      mode: EditorMode.PRINT,
    });

    if (!pages.length) {
      throw new Error('文档为空，无法导出图片');
    }

    const name = `${sanitizeExportBasename(filename)}.png`;

    if (pages.length === 1) {
      saveAs(dataUrlToBlob(pages[0]), name);
      return;
    }

    const images = await Promise.all(pages.map((src) => loadImageFromSrc(src)));
    const imgWidth = images[0].naturalWidth;
    const totalHeight = images.reduce((sum, img) => sum + img.naturalHeight, 0);

    // 长图超出 canvas 上限时等比缩小，保证 toBlob 成功（常规文档 fitScale = 1）
    const fitScale = Math.min(
      1,
      MAX_CANVAS_SIDE / totalHeight,
      Math.sqrt(MAX_CANVAS_AREA / (imgWidth * totalHeight)),
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imgWidth * fitScale));
    canvas.height = Math.max(1, Math.round(totalHeight * fitScale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建画布，无法导出图片');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 用累计高度取整的方式逐页绘制，避免浮点拼接产生缝隙
    let drawnHeight = 0;
    for (const img of images) {
      const y = Math.round(drawnHeight * fitScale);
      const pageHeight = Math.round((drawnHeight + img.naturalHeight) * fitScale) - y;
      ctx.drawImage(img, 0, y, canvas.width, pageHeight);
      drawnHeight += img.naturalHeight;
    }

    saveAs(await canvasToBlob(canvas), name);
  } finally {
    if (previousScale !== 1) {
      editor.command.executePageScale(previousScale);
    }
    if (!wasPaging) {
      editor.command.executePageMode(pageMode);
    }
  }
}

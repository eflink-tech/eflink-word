// docx 导入预览：把解析结果交给离屏 canvas-editor 打印渲染，产出逐页 PNG
// - 复用正式导入的解析结果，不再二次解析文件
// - 离屏实例渲染完立即销毁，不影响主编辑器状态
import { EditorMode, PaperDirection } from '@hufe921/canvas-editor';
import { createEditor } from '../canvas-editor/editor-instance';
import type { ParsedDocx } from './importDocx';

const DEFAULT_PAPER = { width: 794, height: 1123 };
const DEFAULT_MARGINS = { top: 100, right: 120, bottom: 100, left: 120 };

export async function renderDocxPreviewImages(
  parsed: ParsedDocx
): Promise<string[]> {
  const setup = parsed.pageSetup ?? {};
  const [top, right, bottom, left] = setup.margins ?? [
    DEFAULT_MARGINS.top,
    DEFAULT_MARGINS.right,
    DEFAULT_MARGINS.bottom,
    DEFAULT_MARGINS.left,
  ];
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;';
  document.body.appendChild(container);
  const editor = createEditor({
    container,
    data: {
      main: parsed.data.main,
      header: parsed.data.header ?? [],
      footer: parsed.data.footer ?? [],
    },
    paperSize: {
      width: setup.width ?? DEFAULT_PAPER.width,
      height: setup.height ?? DEFAULT_PAPER.height,
    },
    paperDirection:
      setup.paperDirection === 'horizontal'
        ? PaperDirection.HORIZONTAL
        : PaperDirection.VERTICAL,
    pageMargin: { top, right, bottom, left },
    defaultFont: setup.defaultFont ?? 'Microsoft YaHei',
    defaultSize: setup.defaultSize ?? 16,
    watermark: (parsed.watermark as { data?: string } | undefined)?.data,
    // 有页码域时按导入后的配置渲染；没有则关闭，避免渲染文档里不存在的默认页码
    pageNumber: parsed.pageNumber
      ? { ...parsed.pageNumber, disabled: false }
      : { disabled: true },
  });
  try {
    return await editor.command.getImage({
      pixelRatio: 1.5,
      mode: EditorMode.PRINT,
    });
  } finally {
    editor.destroy();
    container.remove();
  }
}

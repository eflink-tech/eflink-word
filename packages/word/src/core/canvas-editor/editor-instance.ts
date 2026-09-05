import Editor from '@hufe921/canvas-editor';
import { ElementType, PaperDirection } from '@hufe921/canvas-editor';
import type { IEditorData, IEditorOption } from '@hufe921/canvas-editor';

export interface CreateEditorOptions {
  container: HTMLDivElement;
  data?: IEditorData;
  paperSize: { width: number; height: number };
  paperDirection: PaperDirection;
  pageMargin: { top: number; right: number; bottom: number; left: number };
  defaultFont: string;
  defaultSize: number;
  watermark?: string;
  /** CSS 选择器，指向实际滚动容器（canvas-editor 用它监听滚动和 IntersectionObserver 视口） */
  scrollContainerSelector?: string;
}

const EMPTY_MAIN = [{ type: ElementType.TEXT, value: '' }];

export function createEditor(opts: CreateEditorOptions): Editor {
  const data: IEditorData = opts.data ?? {
    main: [{ ...EMPTY_MAIN[0] }],
    header: [],
    footer: [],
  };

  // IEditorOption 所有字段均为可选，与 Partial<IEditorOption> 等价，无需类型断言
  const editorOpts: IEditorOption = {
    width: opts.paperSize.width,
    height: opts.paperSize.height,
    margins: [
      opts.pageMargin.top,
      opts.pageMargin.right,
      opts.pageMargin.bottom,
      opts.pageMargin.left,
    ],
    paperDirection: opts.paperDirection,
    defaultFont: opts.defaultFont,
    defaultSize: opts.defaultSize,
    placeholder: { data: '请输入正文' },
    ...(opts.watermark ? { watermark: { data: opts.watermark } } : {}),
    ...(opts.scrollContainerSelector ? { scrollContainerSelector: opts.scrollContainerSelector } : {}),
  };

  return new Editor(opts.container, data, editorOpts);
}

export function destroyEditor(editor: Editor): void {
  editor.destroy();
}

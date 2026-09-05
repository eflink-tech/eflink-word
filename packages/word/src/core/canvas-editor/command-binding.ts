import type Editor from '@hufe921/canvas-editor';
import { PaperDirection, RowFlex, NumberType, ElementType } from '@hufe921/canvas-editor';
import type { IElement } from '@hufe921/canvas-editor';

export function syncPaperSettings(
  editor: Editor,
  opts: {
    paperWidth: number;
    paperHeight: number;
    paperDirection: PaperDirection;
    margin: { top: number; right: number; bottom: number; left: number };
  },
): void {
  // 先设置方向，再设置尺寸（canvas-editor 会根据方向内部处理宽高）
  editor.command.executePaperDirection(opts.paperDirection);
  editor.command.executePaperSize(opts.paperWidth, opts.paperHeight);
  editor.command.executeSetPaperMargin([
    opts.margin.top,
    opts.margin.right,
    opts.margin.bottom,
    opts.margin.left,
  ]);
}

export function syncWatermark(
  editor: Editor,
  text: string | null,
): void {
  if (text && text.trim()) {
    editor.command.executeAddWatermark({ data: text.trim() });
  } else {
    editor.command.executeDeleteWatermark();
  }
}

// 页眉/页脚/页码配置接口
export interface HeaderFooterPageNumberConfig {
  header: {
    enabled: boolean;
    content: string;
    fontSize: number;
    font: string;
    color: string;
    rowFlex: RowFlex;
  };
  footer: {
    enabled: boolean;
    content: string;
    fontSize: number;
    font: string;
    color: string;
    rowFlex: RowFlex;
  };
  pageNumber: {
    enabled: boolean;
    format: string;
    size: number;
    font: string;
    color: string;
    rowFlex: RowFlex;
    numberType: NumberType;
    startPageNo: number;
    fromPageNo: number;
  };
}

/**
 * 同步页眉/页脚/页码配置到编辑器
 *
 * 注意：不可使用 executeUpdateOptions —— 其内部 mn() 会合并完整默认项，
 * 会把 paperDirection 等纸张设置重置为纵向，导致方向切换后约 300ms 被页码刷新打回。
 */
export function syncHeaderFooterPageNumber(
  editor: Editor,
  config: HeaderFooterPageNumberConfig,
): void {
  const options = editor.command.getOptions();

  Object.assign(options.header, config.header.enabled
    ? { editable: true, disabled: false }
    : { disabled: true });

  Object.assign(options.footer, config.footer.enabled
    ? { editable: true, disabled: false }
    : { disabled: true });

  if (config.pageNumber.enabled) {
    Object.assign(options.pageNumber, {
      disabled: false,
      format: config.pageNumber.format,
      size: config.pageNumber.size,
      font: config.pageNumber.font,
      color: config.pageNumber.color,
      rowFlex: config.pageNumber.rowFlex,
      numberType: config.pageNumber.numberType,
      startPageNo: config.pageNumber.startPageNo,
      fromPageNo: config.pageNumber.fromPageNo,
    });
  } else {
    Object.assign(options.pageNumber, { disabled: true });
  }

  // 构建页眉元素
  const headerElements: IElement[] = config.header.enabled && config.header.content
    ? [{
        type: ElementType.TEXT,
        value: config.header.content,
        size: config.header.fontSize,
        font: config.header.font,
        color: config.header.color,
        rowFlex: config.header.rowFlex,
      }]
    : [];

  // 构建页脚元素
  const footerElements: IElement[] = config.footer.enabled && config.footer.content
    ? [{
        type: ElementType.TEXT,
        value: config.footer.content,
        size: config.footer.fontSize,
        font: config.footer.font,
        color: config.footer.color,
        rowFlex: config.footer.rowFlex,
      }]
    : [];

  // 通过 setValue 更新页眉页脚内容
  if (headerElements.length > 0 || footerElements.length > 0) {
    const currentData = editor.command.getValue();
    editor.command.executeSetValue({
      ...currentData,
      header: headerElements,
      footer: footerElements,
    });
  }

  editor.command.executeForceUpdate();
}

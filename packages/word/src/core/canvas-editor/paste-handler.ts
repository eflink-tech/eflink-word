import type Editor from '@hufe921/canvas-editor';
import { ElementType, getElementListByHTML } from '@hufe921/canvas-editor';
import type { IElement } from '@hufe921/canvas-editor';

/**
 * 检测 HTML 是否包含有意义的内联格式（加粗、斜体、颜色、链接等）
 * 若仅含结构标签（p/div/br）和纯文本，返回 false
 */
function hasInlineFormatting(html: string): boolean {
  return (
    /<(b|strong|i|em|u|s|a|span|font|mark|sub|sup)\b/i.test(html) ||
    /style="[^"]*\b(font-weight|font-style|text-decoration|color|background|font-size)\s*:/i.test(html) ||
    /<img\b/i.test(html)
  );
}

/**
 * 清理外部 HTML：移除多余空行、规范化结构
 *
 * 处理以下常见外部 HTML 问题：
 * - block 元素之间的多余 <br>（导致粘贴后出现空行）
 * - 连续多个 <br> 标签
 * - 空段落（仅含空白或 <br>）
 * - Word 特有的样式注释和 mso- 前缀属性
 * - 可能导致额外间距的 margin/padding/line-height 样式
 */
export function cleanPasteHTML(html: string): string {
  let cleaned = html;

  // 1. 移除 HTML 注释（Word 等编辑器产生的条件注释）
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 2. 移除 block 元素之后的所有多余 <br>（如 </p><br><br><p> → </p><p>）
  cleaned = cleaned.replace(
    /<\/(p|div|h[1-6]|li|ul|ol|blockquote|tr)>\s*(<br\s*\/?>\s*)+/gi,
    (_match, tag) => `</${tag}>`,
  );

  // 3. 移除 block 元素之前的多余 <br>（如 <br><p> → <p>）
  cleaned = cleaned.replace(
    /(<br\s*\/?>\s*)+<(p|div|h[1-6]|ul|ol|blockquote|table)/gi,
    (_match, _brs, tag) => `<${tag}`,
  );

  // 4. 连续多个 <br> 合并为一个
  cleaned = cleaned.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');

  // 5. 移除空段落（只含空白、<br> 或 &nbsp; 的 p/div）
  cleaned = cleaned.replace(
    /<(p|div)(\s[^>]*)?>\s*(<br\s*\/?>|&nbsp;| |\s)*<\/\1>/gi,
    '',
  );

  // 6. 移除 Word 特有的 mso- 前缀 CSS 属性
  cleaned = cleaned.replace(/\s*mso-[^:;"\s]+:\s*[^;"}]+/gi, '');

  // 7. 移除可能导致额外间距的 CSS 属性（margin, padding, line-height）
  //    这些属性来自外部网站的样式，会导致粘贴后出现"空行"效果
  cleaned = cleaned.replace(
    /(margin|padding|line-height)(-\w+)?:\s*[^;"}]+/gi,
    '',
  );

  // 8. 清理残留的空 style 属性
  cleaned = cleaned.replace(/\s*style=""/gi, '');

  return cleaned.trim();
}

/**
 * 从 HTML 中提取纯文本（将 block 元素边界转换为换行）
 */
export function htmlToPlainText(html: string): string {
  let text = html;
  // 将 block 元素闭合标签转为换行
  text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');
  // <br> 转为换行
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // 移除所有剩余标签
  text = text.replace(/<[^>]+>/g, '');
  // 解码常见 HTML 实体
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  // 合并连续空行（保留最多一个空行）
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * 挂载自定义粘贴处理器
 *
 * 拦截 canvas-editor 默认粘贴行为，对外部 HTML 进行清理后再插入，
 * 解决从其他网站复制内容时出现多余空行和格式异常的问题。
 *
 * - 有图片文件时：走默认处理（粘贴图片）
 * - 纯文本时：走默认处理
 * - 无内联格式的 HTML（纯文本+结构标签）：提取纯文本插入，避免段落间距
 * - 有格式的 HTML：清理后使用 getElementListByHTML 解析并插入
 */
export function mountPasteHandler(editor: Editor): void {
  editor.override.paste = (evt?: ClipboardEvent) => {
    if (!evt?.clipboardData) return;

    const { clipboardData } = evt;

    // 有图片文件时走默认处理（粘贴图片）
    const types = Array.from(clipboardData.types);
    if (types.includes('Files')) return;

    const html = clipboardData.getData('text/html');
    if (!html) {
      // 纯文本粘贴：走默认处理
      return;
    }

    evt.preventDefault();

    const cleaned = cleanPasteHTML(html);
    const options = editor.command.getOptions();
    const editorWidth = options.width ?? 794;

    try {
      // 若 HTML 无内联格式（如从聊天/文档复制的纯文本），
      // 使用纯文本插入以避免段落间距产生的"空行"
      if (!hasInlineFormatting(cleaned)) {
        const plainText = htmlToPlainText(cleaned);
        if (plainText) {
          const textElement: IElement = {
            type: ElementType.TEXT,
            value: plainText,
          };
          editor.command.executeInsertElementList([textElement]);
        }
      } else {
        const elementList = getElementListByHTML(cleaned, { innerWidth: editorWidth });
        if (elementList.length > 0) {
          editor.command.executeInsertElementList(elementList);
        }
      }
    } catch {
      // HTML 解析失败时回退到纯文本
      const text = clipboardData.getData('text/plain');
      if (text) {
        const textElement: IElement = {
          type: ElementType.TEXT,
          value: text,
        };
        editor.command.executeInsertElementList([textElement]);
      }
    }

    return { preventDefault: true };
  };
}

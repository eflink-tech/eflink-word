// AI 产物 → canvas-editor 元素并写入文档（插入选区/光标处，光标不存在时追加文末）
import { ElementType, ListType, TitleLevel } from '@hufe921/canvas-editor';
import type Editor from '@hufe921/canvas-editor';
import type { IElement } from '@hufe921/canvas-editor';
import { useEditorStore } from '../store/editorStore';
import type { AIDocElement, AIDocument } from './types';

const TITLE_LEVELS: TitleLevel[] = [
  TitleLevel.FIRST,
  TitleLevel.SECOND,
  TitleLevel.THIRD,
  TitleLevel.FOURTH,
  TitleLevel.FIFTH,
  TitleLevel.SIXTH,
];

// A4 纸 794px 宽 - 左右页边距 120px：列宽按此等分（纸张变化时 canvas-editor 会自适应渲染）
const CONTENT_WIDTH = 554;
const TABLE_ROW_HEIGHT = 28;

/** 结构化文档 → canvas-editor IElement 列表 */
export function buildElements(doc: AIDocument): IElement[] {
  const elements: IElement[] = [];
  let listSeq = 0;
  for (const el of doc.elements) {
    switch (el.type) {
      case 'title': {
        const level = TITLE_LEVELS[Math.min(6, Math.max(1, el.level ?? 2)) - 1];
        elements.push({ type: ElementType.TITLE, value: el.text ?? '', level });
        break;
      }
      case 'paragraph': {
        elements.push({ type: ElementType.TEXT, value: el.text ?? '' });
        break;
      }
      case 'list': {
        listSeq += 1;
        const listId = `ai-list-${Date.now()}-${listSeq}`;
        for (const item of el.items ?? []) {
          elements.push({
            type: ElementType.LIST,
            value: item,
            listId,
            listType: el.ordered ? ListType.OL : ListType.UL,
          });
        }
        break;
      }
      case 'table': {
        elements.push(buildTable(el));
        break;
      }
    }
  }
  return elements;
}

function buildTable(el: AIDocElement): IElement {
  const rows: string[][] = [];
  if (el.header?.length) rows.push(el.header);
  for (const r of el.rows ?? []) rows.push(r);
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const normalized = rows.map((r) => {
    const cells = [...r];
    while (cells.length < colCount) cells.push('');
    return cells;
  });
  return {
    type: ElementType.TABLE,
    value: '',
    colgroup: Array.from({ length: colCount }, () => ({
      width: Math.floor(CONTENT_WIDTH / colCount),
    })),
    trList: normalized.map((cells) => ({
      height: TABLE_ROW_HEIGHT,
      tdList: cells.map((cell) => ({
        colspan: 1,
        rowspan: 1,
        value: [{ type: ElementType.TEXT, value: cell }] as IElement[],
      })),
    })),
  };
}

/** 当前光标状态：has=false 表示编辑器尚未持有光标（从未聚焦） */
function rangeInfo(editor: Editor): { has: boolean; isSelection: boolean } {
  const range = editor.command.getRange();
  const has = range.startIndex >= 0 && range.endIndex >= 0;
  return { has, isSelection: has && range.startIndex !== range.endIndex };
}

function getEditor() {
  return useEditorStore.getState().editor;
}

/**
 * 把 AI 文档写入编辑器：有选区/光标时插入选区处（选区被替换），
 * 光标不存在（从未聚焦）时聚焦编辑器放到文末追加。
 * @returns 插入的顶层元素数
 */
export function insertAIDocument(doc: AIDocument): number {
  const editor = getEditor();
  if (!editor) throw new Error('编辑器尚未就绪');
  const elements = buildElements(doc);
  if (!elements.length) return 0;
  const { has } = rangeInfo(editor);
  if (has) {
    editor.command.executeInsertElementList(elements);
  } else {
    // 未聚焦过时无光标：聚焦并置于文末追加，保证内容必定写入
    editor.command.executeFocus();
    const after = rangeInfo(editor);
    if (after.has) {
      editor.command.executeInsertElementList(elements);
    } else {
      editor.command.executeAppendElementList(elements);
    }
  }
  return elements.length;
}

/** 用纯文本结果替换当前选区（无选区时插入光标处）；多段落拆为多个文本元素 */
export function replaceSelectionWithText(text: string): void {
  const editor = getEditor();
  if (!editor) throw new Error('编辑器尚未就绪');
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const elements: IElement[] = (paragraphs.length ? paragraphs : [text]).map((p) => ({
    type: ElementType.TEXT,
    value: p,
  }));
  const { has } = rangeInfo(editor);
  if (has) {
    editor.command.executeInsertElementList(elements);
  } else {
    editor.command.executeFocus();
    const after = rangeInfo(editor);
    if (after.has) {
      editor.command.executeInsertElementList(elements);
    } else {
      editor.command.executeAppendElementList(elements);
    }
  }
}

/** 取选区文本；无选区返回空串 */
export function getSelectedText(): string {
  const editor = getEditor();
  if (!editor) return '';
  const { has, isSelection } = rangeInfo(editor);
  if (!has || !isSelection) return '';
  return editor.command.getRangeText();
}

/** 取文档全文（供 AI 上下文），超长截断 */
export function getDocumentText(maxLength = 2400): string {
  const editor = getEditor();
  if (!editor) return '';
  const text = editor.command.getText().main.replace(/\n{3,}/g, '\n\n').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n…（后文已省略）` : text;
}

/** 文档是否为空（无任何正文文字） */
export function isDocumentEmpty(): boolean {
  return getDocumentText(32).length === 0;
}

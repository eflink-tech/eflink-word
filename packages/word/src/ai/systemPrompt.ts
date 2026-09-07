// AI 提示词与结果解析：约定输出结构化 JSON，由 actionExecutor 落为 canvas-editor 元素
import type { AIDocElement, AIDocument } from './types';

const ELEMENT_TYPES = new Set(['title', 'paragraph', 'list', 'table']);
const MAX_ELEMENTS = 300;
const MAX_TEXT_LENGTH = 5000;

export const DOC_SCHEMA_PROMPT = `输出 JSON（不要输出 JSON 之外的任何文字），结构如下：
{
  "title": "文档标题",
  "elements": [
    { "type": "title", "level": 1, "text": "一级标题" },
    { "type": "paragraph", "text": "正文段落……" },
    { "type": "list", "ordered": false, "items": ["条目一", "条目二"] },
    { "type": "table", "header": ["列一", "列二"], "rows": [["内容", "内容"]] }
  ]
}
约定：level 取 1-6 对应一至六级标题；正文一律用 paragraph（一段一个元素，不要用 \\n 换行）；并列内容用 list；表格首行为表头；不要输出 markdown 代码块。`;

/** 生成整篇文档的提示词 */
export function buildDocPrompt(topic: string, requirements: string): string {
  return `请围绕主题「${topic}」撰写一篇结构完整的文档（含标题、各级小标题、正文段落，适当使用列表或表格）。
${requirements ? `要求：${requirements}\n` : ''}${DOC_SCHEMA_PROMPT}`;
}

/** 对选中/全文做写作辅助的提示词（结果为纯文本，逐段返回） */
export function buildTextPrompt(templateContent: string, text: string, context: string): string {
  return templateContent.replace('{text}', text) + (context ? `\n\n（供参考的上下文：${context}）` : '');
}

export function parseJSONFromText(text: string): unknown {
  // 去掉可能的 markdown 代码块包裹
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // 尝试截取第一个 { 到最后一个 }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI 返回的内容不是有效的 JSON');
  }
}

/** 解析并校验 AI 文档：非法元素丢弃、超量截断、字段类型归一 */
export function parseAIDocument(text: string): AIDocument {
  const data = parseJSONFromText(text) as Partial<AIDocument>;
  if (!data || !Array.isArray(data.elements)) throw new Error('文档 JSON 结构不正确');
  const elements: AIDocElement[] = [];
  for (const raw of data.elements.slice(0, MAX_ELEMENTS)) {
    if (!raw || typeof raw !== 'object') continue;
    const el = raw as AIDocElement;
    if (!ELEMENT_TYPES.has(el.type)) continue;
    switch (el.type) {
      case 'title':
        if (typeof el.text === 'string' && el.text.trim()) {
          elements.push({ type: 'title', level: clampInt(el.level, 1, 6, 2), text: el.text.trim() });
        }
        break;
      case 'paragraph':
        if (typeof el.text === 'string' && el.text.trim()) {
          elements.push({ type: 'paragraph', text: clip(el.text) });
        }
        break;
      case 'list': {
        const items = Array.isArray(el.items) ? el.items.map((i) => String(i ?? '').trim()).filter(Boolean) : [];
        if (items.length) {
          elements.push({ type: 'list', ordered: el.ordered === true, items: items.slice(0, 50) });
        }
        break;
      }
      case 'table': {
        const header = Array.isArray(el.header) ? el.header.map((h) => String(h ?? '')) : [];
        const rows = Array.isArray(el.rows)
          ? el.rows
              .filter((r) => Array.isArray(r))
              .map((r) => r.map((c) => String(c ?? '')))
              .slice(0, 100)
          : [];
        if (rows.length || header.length) {
          elements.push({ type: 'table', header, rows });
        }
        break;
      }
    }
  }
  if (!elements.length) throw new Error('AI 未生成有效的文档内容');
  return {
    title: typeof data.title === 'string' ? data.title : undefined,
    elements,
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clip(text: string): string {
  const t = text.replace(/\r/g, '');
  return t.length > MAX_TEXT_LENGTH ? `${t.slice(0, MAX_TEXT_LENGTH)}…` : t;
}

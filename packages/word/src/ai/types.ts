// AI 模块类型定义（与 eflink-pptx / eflink-draw 的 AI 模块同构）
export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  /** 关联产物（如已插入文档的结构化 JSON） */
  payload?: unknown;
  time: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  builtin: boolean;
  /** 提示词模板：{text} 占位符替换选区/全文内容 */
  content: string;
}

export class AIError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AIError';
    this.cause = cause;
  }
}

/** AI 生成的文档结构（systemPrompt 约定，actionExecutor 落为 canvas-editor 元素） */
export interface AIDocElement {
  type: 'title' | 'paragraph' | 'list' | 'table';
  text?: string;
  /** 标题级别 1-6 */
  level?: number;
  /** list 是否有序 */
  ordered?: boolean;
  items?: string[];
  header?: string[];
  rows?: string[][];
}

export interface AIDocument {
  title?: string;
  elements: AIDocElement[];
}

/** 判断错误是否为用户取消 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : '';
  return /aborted/i.test(message);
}

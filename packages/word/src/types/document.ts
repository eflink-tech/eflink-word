import { nanoid } from 'nanoid';
import type { IEditorData } from '@hufe921/canvas-editor';
import { ElementType } from '@hufe921/canvas-editor';

// canvas-editor 原生类型，无需自定义扩展
export type CanvasEditorData = IEditorData;

// 空文档：含一个空文本元素，保证打开即可点击输入
// canvas-editor 的 executeSetValue 会内部拷贝数据，因此共享常量是安全的
export const EMPTY_DOC_CONTENT: CanvasEditorData = {
  main: [{ type: ElementType.TEXT, value: '' }],
};

// Word 文档数据模型
export interface WordDocument {
  id: string;                    // 文档 ID (nanoid)
  title: string;                 // 文档标题
  content: CanvasEditorData;     // canvas-editor 原生数据格式
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  thumbnail?: string;            // 缩略图 (base64)
  isFavorite: boolean;           // 是否收藏
  isDeleted: boolean;            // 是否软删除
}

/** 文档元信息（列表用，不含正文） */
export interface DocumentMeta {
  id: string;
  title: string;
  updatedAt: number;
}

// 创建新文档的参数
export interface CreateDocumentParams {
  title?: string;
  content?: CanvasEditorData;
}

// 更新文档的参数
export interface UpdateDocumentParams {
  title?: string;
  content?: CanvasEditorData;
  thumbnail?: string;
  isFavorite?: boolean;
}

/** 新建一篇文档：生成 id、默认标题与空正文（不落库，落库走 StorageAdapter.save） */
export function createWordDocument(params: CreateDocumentParams = {}): WordDocument {
  const now = Date.now();
  return {
    id: nanoid(),
    title: params.title || '未命名文档',
    content: params.content || EMPTY_DOC_CONTENT,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    isDeleted: false,
  };
}

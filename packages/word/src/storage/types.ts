import type { CanvasEditorData, DocumentMeta, WordDocument } from '../types/document';

/**
 * 文档存储适配器：编辑器所有落库行为都经由该接口。
 * 内置 IndexedDB / 内存实现；宿主可注入自定义实现对接后端 API。
 */
export interface StorageAdapter {
  /** 新建/整体覆盖保存（新建文档、导入、收藏状态整体写回时用） */
  save(doc: WordDocument): Promise<void>;
  /** 按 id 读取完整文档 */
  load(id: string): Promise<WordDocument | undefined>;
  /** 文档元信息列表（按更新时间倒序） */
  list(): Promise<DocumentMeta[]>;
  /** 删除文档（内置实现为软删除，与历史单体版行为一致） */
  delete(id: string): Promise<void>;
  /** 仅改标题，不触碰正文内容 */
  rename(id: string, title: string): Promise<void>;
  /** 编辑器保存：标题 + 正文一起落库 */
  updateContent(id: string, title: string, content: CanvasEditorData): Promise<void>;
  /** 测试辅助：清空全部文档（可选实现） */
  clear?(): Promise<void>;
}

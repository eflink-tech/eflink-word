/** @eflink-tech/word 对外导出面：组件 + headless API + 存储适配器 */
import './styles.css';

// 组件
export { WordEditor } from './components/WordEditor';
export type { WordEditorProps, WordEditorBrand } from './components/WordEditor';

// 存储适配器
export type { StorageAdapter } from './storage/types';
export { indexedDbStorage } from './storage/indexedDb';
export { memoryStorage } from './storage/memory';
export { getDefaultStorage, setDefaultStorage } from './storage/registry';
// 宿主外观：顶栏返回按钮链接
export { setEditorBackHref } from './core/chrome';

// headless：.efword 文档备份导入导出、PDF 导出（编辑器实例可经 useEditorStore 获取）
export {
  exportEfword,
  importEfword,
  exportPdf,
  EFWORD_FORMAT,
  EFWORD_VERSION,
  EFWORD_EXTENSION,
} from './core/utils/exportImport';
export type { EfwordFile, EfwordSource, ExportEfwordOptions } from './core/utils/exportImport';

// 数据模型
export { createWordDocument, EMPTY_DOC_CONTENT } from './types/document';
export type {
  WordDocument,
  DocumentMeta,
  CanvasEditorData,
  CreateDocumentParams,
  UpdateDocumentParams,
} from './types/document';

// 状态（宿主可读取编辑器/文档/界面状态，或发起新建、重命名等操作）
export { useDocumentStore } from './store/documentStore';
export { useEditorStore } from './store/editorStore';
export { useUIStore, PAPER_SIZES, MARGIN_PRESETS } from './store/uiStore';
export type {
  PaperSize,
  PageMargin,
  EditorPrefs,
  HeaderFooterConfig,
  PageNumberConfig,
} from './store/uiStore';

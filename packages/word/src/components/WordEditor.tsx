import { useEffect, useCallback, useRef, useState } from 'react';
import { Share2, MessageCircle } from 'lucide-react';
import { useDocumentStore } from '../store/documentStore';
import { useEditorStore } from '../store/editorStore';
import { useUIStore } from '../store/uiStore';
import { Toolbar } from './toolbar/Toolbar';
import { BrandHeader } from './toolbar/BrandHeader';
import { ShareDialog } from './toolbar/ShareDialog';
import { SearchPanel } from './toolbar/SearchPanel';
import { Editor } from './editor/Editor';
import { CatalogPanel } from '../components/sidebar/CatalogPanel';
import { AIChatPanel } from './ai/AIChatPanel';
import { StatusBar } from './statusbar/StatusBar';
import { EditorSettingsModal } from './statusbar/EditorSettingsModal';
import { useHotkeys } from '../hooks/useHotkeys';
import { setDefaultStorage } from '../storage/registry';
import { writeDraft, removeDraft } from '../storage/draft';
import { getWordShareHandler } from '../core/share/shareBridge';
import type { WordDocument } from '../types/document';
import type { StorageAdapter } from '../storage/types';

/** 品牌区配置：编辑器左上角的 logo 与产品名 */
export interface WordEditorBrand {
  logo?: string;
  name: string;
}

export interface WordEditorProps {
  /** 要打开的文档 id，内容经 storage 加载 */
  docId: string;
  /** 文档存储实现；传入后注册为全局默认。缺省用内置 IndexedDB（库名 eflink-word） */
  storage?: StorageAdapter;
  /** 品牌区（logo + 产品名）；不传或传 false 隐藏 */
  branding?: WordEditorBrand | false;
  /** 是否显示工具栏（默认显示） */
  showToolbar?: boolean;
  /** 是否显示左侧目录（默认显示；窄屏自动折叠为悬浮标签） */
  showCatalog?: boolean;
  /** 是否显示底部状态栏（默认显示） */
  showStatusBar?: boolean;
  /** 有未保存修改时拦截页面关闭提示（独立站点建议开启；嵌入宿主时默认关闭） */
  guardUnload?: boolean;
  /** 新建文档等导致当前文档 id 变化时回调（宿主据此同步路由等） */
  onDocIdChange?: (id: string) => void;
  /** 文档加载完成回调（宿主可在此记录「最近文档」等） */
  onDocLoaded?: (doc: WordDocument) => void;
  /** 文档加载失败/不存在回调 */
  onDocError?: (err: unknown) => void;
}

export function WordEditor({
  docId,
  storage,
  branding = false,
  showToolbar = true,
  showCatalog = true,
  showStatusBar = true,
  guardUnload = false,
  onDocIdChange,
  onDocLoaded,
  onDocError,
}: WordEditorProps) {
  const { currentDocument, openDocument, setDocIdChangeListener } = useDocumentStore();
  const { editor, save, isDirty, contentVersion } = useEditorStore();
  const {
    viewMode,
    paperSize,
    paperDirection,
    searchPanelOpen,
    setSearchPanelOpen,
    catalogOpen,
    settingsOpen,
    aiPanelOpen,
  } = useUIStore();

  const stackRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  // 滚动容器（print-root）：目录滚动高亮依赖它
  const scrollRef = useRef<HTMLDivElement>(null);

  // 分享弹窗（doc 为点击"分享"时刻的文档快照，弹窗期间编辑不影响本次分享内容）
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<WordDocument | null>(null);
  const closeShare = useRef(() => setShareOpen(false)).current;
  // 分享前先落库最新内容，并以编辑器实时内容为准覆盖文档快照
  const openShare = useCallback(async () => {
    const editorState = useEditorStore.getState();
    await editorState.save();
    const doc = useDocumentStore.getState().currentDocument;
    if (!doc) return;
    const value = editorState.editor?.command.getValue();
    setShareDoc(value?.data ? { ...doc, content: value.data } : doc);
    setShareOpen(true);
  }, []);

  // 页面宽度：目录在窄屏（<1200px）下折叠为悬浮标签/浮层
  const [windowWidth, setWindowWidth] = useState(0);
  const [floatingOpen, setFloatingOpen] = useState(false);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const catalogFloating = windowWidth > 0 && windowWidth < 1200;

  // 页面实际尺寸（横向时宽高互换）
  const paperWidth = paperDirection === 'vertical' ? paperSize.width : paperSize.height;
  const paperHeight = paperDirection === 'vertical' ? paperSize.height : paperSize.width;

  const catalogDocked = showCatalog && catalogOpen && !catalogFloating;
  const CATALOG_WIDTH = 264;
  // 纸张尽量整页居中；若会伸进目录下方，则右移到目录右缘之外
  const idealLeft = windowWidth > 0 ? (windowWidth - paperWidth) / 2 : 0;
  const pageClearShift =
    catalogDocked && windowWidth > 0 ? Math.max(0, CATALOG_WIDTH - idealLeft) : 0;

  // 注入自定义存储；注册文档 id 变化监听（回调走 ref：父组件传内联函数时避免反复注册）
  const onIdChangeRef = useRef(onDocIdChange);
  onIdChangeRef.current = onDocIdChange;
  useEffect(() => {
    if (storage) setDefaultStorage(storage);
  }, [storage]);
  useEffect(() => {
    setDocIdChangeListener((id) => onIdChangeRef.current?.(id));
    return () => setDocIdChangeListener(null);
  }, [setDocIdChangeListener]);

  // docId 变化时（首次进入 / 切换文档）：加载指定文档；不存在则回调宿主
  useEffect(() => {
    let disposed = false;
    // 切换前清掉上一篇的未保存标记，避免自动保存误写新文档
    useEditorStore.setState({ isDirty: false });
    openDocument(docId).then((doc) => {
      if (disposed) return;
      if (!doc) {
        onDocError?.(new Error(`文档不存在: ${docId}`));
        return;
      }
      onDocLoaded?.(doc);
    });
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, storage]);

  // 本地草稿兜底（防抖 2 秒，沿用原自动保存间隔）：内容变化后写入 localStorage。
  // 不调用云端保存、不清 dirty（dirty 仅在云端保存成功后清除）；
  // dirty 停留 true 期间靠 contentVersion（每次编辑递增）驱动防抖重新计时。
  useEffect(() => {
    if (!isDirty || !editor) return;
    const timer = setTimeout(() => {
      try {
        const { currentDocId } = useDocumentStore.getState();
        if (!currentDocId) return;
        const value = editor.command.getValue();
        if (value?.data) writeDraft(currentDocId, value.data);
      } catch {
        // 草稿写入失败静默降级（隐私模式/存储不可用等），不影响编辑
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isDirty, editor, contentVersion]);

  // 注册 window bridge：宿主可在路由跳转/离页前查询脏状态、触发保存或丢弃本地草稿
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__eflinkEditorBridge = {
      isDirty: () => useEditorStore.getState().isDirty,
      save: () => useEditorStore.getState().save(),
      discard: () => {
        // removeDraft 内部已 try/catch，静默失败
        const docId = useDocumentStore.getState().currentDocId;
        if (docId) removeDraft(docId);
      },
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__eflinkEditorBridge;
    };
  }, []);

  // 有未保存修改时拦截页面关闭（独立站点行为；嵌入宿主默认关闭）
  useEffect(() => {
    if (!guardUnload) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isDirty) {
        e.preventDefault();
        e.returnValue = '您有未保存的数据，确定要离开吗？';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [guardUnload]);

  // 快捷键
  const handleSave = useCallback(() => {
    save();
  }, [save]);

  useHotkeys('ctrl+s,cmd+s', handleSave);
  useHotkeys('ctrl+f,cmd+f', () => setSearchPanelOpen(true));
  useHotkeys('ctrl+0,cmd+0', () => {
    const { editor: ed } = useEditorStore.getState();
    ed?.command.executePageScaleRecovery();
  });
  useHotkeys('ctrl+=,cmd+=', () => {
    const { editor: ed } = useEditorStore.getState();
    ed?.command.executePageScaleAdd();
  });
  useHotkeys('ctrl+-,cmd+-', () => {
    const { editor: ed } = useEditorStore.getState();
    ed?.command.executePageScaleMinus();
  });

  if (!currentDocument) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f5f6f7] text-sm text-[#8f959e]">
        正在加载文档...
      </div>
    );
  }

  const hasTopRow = Boolean(branding) || showToolbar;

  return (
    <div className="h-full min-w-[960px] flex flex-col bg-[#f5f6f7]">
      {/* 顶部单行：左侧品牌+文档标题，中间居中工具栏，右侧分享入口 */}
      {hasTopRow && (
        <div className="no-print relative z-[101] flex h-10 shrink-0 items-center border-b border-black/[0.06] bg-white px-3">
          {branding ? <BrandHeader logo={branding.logo} name={branding.name} /> : null}
          {showToolbar && <Toolbar editor={editor} />}
          {/* 分享入口仅在宿主注入分享实现后出现（纯组件独立运行时不显示） */}
          {getWordShareHandler() !== null && (
            <>
            <button
              type="button"
              onClick={() => void openShare()}
              title="生成分享链接"
              className="ml-1 flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-[#4c5158] transition-colors hover:bg-black/[0.06] hover:text-[#1f2329]"
            >
              <Share2 size={14} />
              分享
            </button>
            <button
              type="button"
              onClick={() => window.open('/contact', '_blank')}
              title="问题反馈"
              className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-[#4c5158] transition-colors hover:bg-black/[0.06] hover:text-[#1f2329]"
            >
              <MessageCircle size={14} />
              反馈
            </button>
            </>
          )}
        </div>
      )}

      {/* 主区域：编辑区铺满并相对整页居中；目录浮层叠在左侧不挤占居中基准；AI 面板独占右侧一列 */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div ref={scrollRef} className="print-root absolute inset-0 overflow-y-auto">
            <div ref={innerRef} className="relative flex min-h-full flex-col items-center pt-[20px] pb-[40px]">
              <div
                ref={stackRef}
                className={`relative z-[1] flex flex-col items-center${viewMode === 'page' ? ' page-stack--paged' : ''}`}
                style={{
                  width: paperWidth,
                  minHeight: paperHeight,
                  marginLeft: pageClearShift || undefined,
                }}
              >
                <Editor
                  className="relative z-[1]"
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                />
              </div>
            </div>
          </div>

        {showCatalog && catalogOpen && !catalogFloating && (
          <aside className="no-print absolute inset-y-0 left-0 z-10 flex w-[264px] flex-col border-r border-black/[0.08] bg-[#f5f6f7]">
            <CatalogPanel editor={editor} />
          </aside>
        )}
        {showCatalog && catalogOpen && catalogFloating && !floatingOpen && (
          <button
            type="button"
            onClick={() => setFloatingOpen(true)}
            title="展开目录"
            aria-label="展开目录"
            className="no-print absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-r-md border border-l-0 border-black/[0.08] bg-white px-[7px] py-3 shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
          >
            <span
              className="text-[13px] leading-5 text-[#1f2329]"
              style={{ writingMode: 'vertical-rl', letterSpacing: '4px' }}
            >
              目录
            </span>
          </button>
        )}
        {showCatalog && catalogOpen && catalogFloating && floatingOpen && (
          <div className="no-print absolute inset-y-0 left-0 z-20 flex w-[264px] flex-col border-r border-black/[0.08] bg-[#f5f6f7] shadow-[4px_0_16px_rgba(0,0,0,0.08)]">
            <CatalogPanel
              editor={editor}
              onClose={() => setFloatingOpen(false)}
            />
          </div>
        )}
        </div>

        {/* AI 助手面板（右侧独立列，参考 eflink-draw / eflink-pptx） */}
        {aiPanelOpen && <AIChatPanel />}
      </div>

      {searchPanelOpen && (
        <SearchPanel editor={editor} onClose={() => setSearchPanelOpen(false)} />
      )}

      {settingsOpen && <EditorSettingsModal />}

      {showStatusBar && <StatusBar editor={editor} />}

      <ShareDialog open={shareOpen} doc={shareDoc} onClose={closeShare} />
    </div>
  );
}

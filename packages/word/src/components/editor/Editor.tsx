import { useEffect, useRef, type CSSProperties } from 'react';
import { ElementType, PaperDirection } from '@hufe921/canvas-editor';
import type { IEditorData } from '@hufe921/canvas-editor';
import { useEditorStore } from '../../store/editorStore';
import { useDocumentStore } from '../../store/documentStore';
import { useUIStore } from '../../store/uiStore';
import { createEditor, destroyEditor } from '../../core/canvas-editor/editor-instance';
import { mountPasteHandler } from '../../core/canvas-editor/paste-handler';
import { mountEventBridge, type EventBridgeHandle } from '../../core/canvas-editor/event-bridge';
import { syncPaperSettings, syncWatermark, syncHeaderFooterPageNumber } from '../../core/canvas-editor/command-binding';

interface EditorProps {
  className?: string;
  style?: CSSProperties;
}

// 将 uiStore 的字符串方向值映射为 canvas-editor 的 PaperDirection 枚举
function toPaperDirection(dir: 'vertical' | 'horizontal'): PaperDirection {
  return dir === 'horizontal' ? PaperDirection.HORIZONTAL : PaperDirection.VERTICAL;
}

// 空文档默认内容：与 ElementType.TEXT 枚举值 'text' 对应
// canvas-editor 的 executeSetValue 会内部拷贝数据，因此共享常量是安全的
const EMPTY_DOC_DATA: IEditorData = {
  main: [{ type: ElementType.TEXT, value: '' }],
  header: [],
  footer: [],
};

export function Editor({ className = '', style }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof createEditor> | null>(null);
  const bridgeRef = useRef<EventBridgeHandle | null>(null);
  // 在 init 完成前若有文档切换请求，暂存于此；init 完成后立即应用
  const pendingDocRef = useRef<IEditorData | null>(null);
  // 标记组件是否已卸载，防止在已销毁的 editor 上执行异步操作
  const destroyedRef = useRef(false);

  const setEditor = useEditorStore((s) => s.setEditor);
  const setIsDirty = useEditorStore((s) => s.setIsDirty);
  const setRangeStyle = useEditorStore((s) => s.setRangeStyle);
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage);
  const setTotalPages = useEditorStore((s) => s.setTotalPages);
  const setPageScale = useEditorStore((s) => s.setPageScale);
  const setWordCount = useEditorStore((s) => s.setWordCount);
  const currentDocument = useDocumentStore((s) => s.currentDocument);

  const paperSize = useUIStore((s) => s.paperSize);
  const paperDirection = useUIStore((s) => s.paperDirection);
  const margin = useUIStore((s) => s.margin);
  const watermark = useUIStore((s) => s.watermark);
  const editorPrefs = useUIStore((s) => s.editorPrefs);
  const headerConfig = useUIStore((s) => s.headerConfig);
  const footerConfig = useUIStore((s) => s.footerConfig);
  const pageNumberConfig = useUIStore((s) => s.pageNumberConfig);

  // 使用 ref 追踪最新值，避免 init effect 闭包捕获过期初始值
  const paperSizeRef = useRef(paperSize);
  const paperDirectionRef = useRef(paperDirection);
  const marginRef = useRef(margin);
  const watermarkRef = useRef(watermark);
  const editorPrefsRef = useRef(editorPrefs);
  const headerConfigRef = useRef(headerConfig);
  const footerConfigRef = useRef(footerConfig);
  const pageNumberConfigRef = useRef(pageNumberConfig);
  const currentDocRef = useRef(currentDocument);
  useEffect(() => { paperSizeRef.current = paperSize; }, [paperSize]);
  useEffect(() => { paperDirectionRef.current = paperDirection; }, [paperDirection]);
  useEffect(() => { marginRef.current = margin; }, [margin]);
  useEffect(() => { watermarkRef.current = watermark; }, [watermark]);
  useEffect(() => { editorPrefsRef.current = editorPrefs; }, [editorPrefs]);
  useEffect(() => { headerConfigRef.current = headerConfig; }, [headerConfig]);
  useEffect(() => { footerConfigRef.current = footerConfig; }, [footerConfig]);
  useEffect(() => { pageNumberConfigRef.current = pageNumberConfig; }, [pageNumberConfig]);
  useEffect(() => { currentDocRef.current = currentDocument; }, [currentDocument]);

  // 初始化：挂载后创建 canvas-editor 实例
  // 注意：此处有意使用 [] 依赖，仅在挂载时执行一次。
  // 若挂载时 currentDocument 尚未加载（为 null），编辑器将以空白内容创建；
  // 下方「切换文档」effect 会在 currentDocument 加载完成后自动应用正确内容。
  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const dir = paperDirectionRef.current;
    const size = paperSizeRef.current;
    // 传递基础纸张尺寸（不手动交换宽高），由 canvas-editor 根据 paperDirection 内部处理
    const paperWidth = size.width;
    const paperHeight = size.height;

    const prefs = editorPrefsRef.current;
    // 提取字体族名称（去除引号和备用字体）
    const defaultFont =
      prefs.fontFamily.split(',')[0].replace(/['"]/g, '').trim() || 'Microsoft YaHei';
    const defaultSize = parseFloat(prefs.fontSize) || 16;

    const editor = createEditor({
      container: containerRef.current,
      data: currentDocRef.current?.content ?? undefined,
      paperSize: { width: paperWidth, height: paperHeight },
      paperDirection: toPaperDirection(dir),
      pageMargin: marginRef.current,
      defaultFont,
      defaultSize,
      watermark: watermarkRef.current ?? undefined,
      scrollContainerSelector: '.print-root',
    });

    editorRef.current = editor;
    mountPasteHandler(editor);
    setEditor(editor);

    // 字数统计防抖刷新
    let wordTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshWordCount = () => {
      if (wordTimer) clearTimeout(wordTimer);
      wordTimer = setTimeout(() => {
        // 若组件已卸载，跳过异步操作
        if (destroyedRef.current) return;
        editor.command
          .getWordCount()
          .then((count) => {
            if (!destroyedRef.current) setWordCount(count);
          })
          .catch(() => {
            // 忽略获取字数失败
          });
      }, 300);
    };

    bridgeRef.current = mountEventBridge(editor, {
      onRangeStyleChange: (rangeStyle) => setRangeStyle(rangeStyle),
      onContentChange: () => {
        setIsDirty(true);
        refreshWordCount();
      },
      onPageNoChange: (pageNo) => setCurrentPage(pageNo + 1),
      onPageSizeChange: (total) => setTotalPages(total),
      onPageScaleChange: (scale) => setPageScale(scale),
    });

    // 初始化时刷新一次字数
    refreshWordCount();

    // init 完成后，检查是否有排队等待的文档切换请求
    if (pendingDocRef.current) {
      editor.command.executeSetValue(pendingDocRef.current);
      pendingDocRef.current = null;
    }

    return () => {
      destroyedRef.current = true;
      bridgeRef.current?.unmount();
      bridgeRef.current = null;
      if (wordTimer) clearTimeout(wordTimer);
      destroyEditor(editor);
      editorRef.current = null;
      const store = useEditorStore.getState();
      if (store.editor === editor) {
        useEditorStore.setState({ editor: null, isReady: false });
      }
    };
  }, []);

  // 切换文档：根据文档 id 变化同步编辑器内容
  // 若 init 尚未完成（editorRef 为空），将数据排队，由 init effect 末尾应用
  useEffect(() => {
    if (!currentDocument) return;
    const data: IEditorData = {
      main: currentDocument.content?.main ?? EMPTY_DOC_DATA.main,
      header: currentDocument.content?.header ?? [],
      footer: currentDocument.content?.footer ?? [],
    };
    if (editorRef.current) {
      editorRef.current.command.executeSetValue(data);
    } else {
      // 排队：init 完成时应用
      pendingDocRef.current = data;
    }
  }, [currentDocument?.id]);

  // 同步纸张尺寸 / 边距 / 方向
  useEffect(() => {
    if (!editorRef.current) return;
    // 传递基础纸张尺寸（不手动交换宽高），由 canvas-editor 根据 paperDirection 内部处理
    syncPaperSettings(editorRef.current, {
      paperWidth: paperSize.width,
      paperHeight: paperSize.height,
      paperDirection: toPaperDirection(paperDirection),
      margin,
    });
  }, [paperSize, paperDirection, margin]);

  // 同步水印
  useEffect(() => {
    if (!editorRef.current) return;
    syncWatermark(editorRef.current, watermark ?? null);
  }, [watermark]);

  // 同步页眉/页脚/页码配置
  useEffect(() => {
    if (!editorRef.current) return;
    syncHeaderFooterPageNumber(editorRef.current, {
      header: headerConfig,
      footer: footerConfig,
      pageNumber: pageNumberConfig,
    });
  }, [headerConfig, footerConfig, pageNumberConfig]);

  // 监听页数变化，强制刷新页码显示（修复 canvas-editor 页码渲染延迟问题）
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const bus = editor.eventBus;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    // 延迟刷新页码配置的函数
    const refreshPageNumber = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (editorRef.current && pageNumberConfigRef.current.enabled) {
          syncHeaderFooterPageNumber(editorRef.current, {
            header: headerConfigRef.current,
            footer: footerConfigRef.current,
            pageNumber: pageNumberConfigRef.current,
          });
        }
      }, 300);
    };

    // 监听 pageSizeChange 和 contentChange 事件
    bus.on('pageSizeChange', refreshPageNumber);
    bus.on('contentChange', refreshPageNumber);

    return () => {
      bus.off('pageSizeChange', refreshPageNumber);
      bus.off('contentChange', refreshPageNumber);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, []);

  return <div ref={containerRef} className={className} style={style} />;
}

// 目录面板：基于 canvas-editor 事件驱动（contentChange / intersectionPageNoChange）
// 保留旧 UI：宽屏 dock / 窄屏浮层、折叠箭头、层级缩进、当前高亮、点击跳转
import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';
import type { ICatalogItem } from '@hufe921/canvas-editor';
import { TitleLevel } from '@hufe921/canvas-editor';
import { useDocumentStore } from '../../store/documentStore';

interface CatalogPanelProps {
  editor: Editor | null;
  /** 浮层模式下的关闭按钮 */
  onClose?: () => void;
}

/** 目录激活高亮蓝（对齐微信文档目录） */
const ACTIVE_COLOR = '#2a5fc9';

/** 将 TitleLevel 映射为 1..6 的数字，便于缩进/字号计算 */
function levelToNumber(level: TitleLevel): number {
  switch (level) {
    case TitleLevel.FIRST:
      return 1;
    case TitleLevel.SECOND:
      return 2;
    case TitleLevel.THIRD:
      return 3;
    case TitleLevel.FOURTH:
      return 4;
    case TitleLevel.FIFTH:
      return 5;
    case TitleLevel.SIXTH:
      return 6;
    default:
      return 1;
  }
}

/** 扁平化遍历：用于查找当前激活项（沿 pageNo 升序，取 <= visiblePageNo 的最后一项） */
function findActiveItem(
  items: ICatalogItem[],
  visiblePageNo: number,
): ICatalogItem | null {
  let active: ICatalogItem | null = null;
  const walk = (arr: ICatalogItem[]) => {
    for (const item of arr) {
      if (item.pageNo <= visiblePageNo) active = item;
      walk(item.subCatalog);
    }
  };
  walk(items);
  return active;
}

export function CatalogPanel({ editor, onClose }: CatalogPanelProps) {
  const docTitle = useDocumentStore((st) => st.currentDocument?.title ?? '');
  const [items, setItems] = useState<ICatalogItem[]>([]);
  const [visiblePageNo, setVisiblePageNo] = useState<number>(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // 拉取最新目录
  const refresh = useCallback(async () => {
    if (!editor) {
      setItems([]);
      return;
    }
    try {
      const catalog = await editor.command.getCatalog();
      setItems(catalog ?? []);
    } catch {
      setItems([]);
    }
  }, [editor]);

  // 挂载/卸载事件：contentChange（内容变化刷新目录）/ intersectionPageNoChange（当前页变化）
  useEffect(() => {
    if (!editor) return;
    refresh();

    const onContentChange = () => {
      refresh();
    };
    const onPageChange = (pageNo: number) => {
      setVisiblePageNo(pageNo);
    };

    editor.eventBus.on('contentChange', onContentChange);
    editor.eventBus.on('intersectionPageNoChange', onPageChange);
    return () => {
      editor.eventBus.off('contentChange', onContentChange);
      editor.eventBus.off('intersectionPageNoChange', onPageChange);
    };
  }, [editor, refresh]);

  // 折叠/展开
  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 点击跳转：传 ICatalogItem.id
  const jumpTo = (item: ICatalogItem) => {
    if (!editor) return;
    editor.command.executeLocationCatalog(item.id);
  };

  // 当前激活项 id
  const activeId = findActiveItem(items, visiblePageNo)?.id ?? null;

  // 文字样式按级别（对齐参考：字号偏小、层级略区分）
  const textStyle = (level: TitleLevel) => {
    const n = levelToNumber(level);
    return n === 1
      ? 'text-[13px] font-semibold leading-[18px]'
      : n === 2
        ? 'text-[12px] font-semibold leading-[17px]'
        : 'text-[12px] leading-[17px]';
  };

  // 递归渲染目录项
  const renderItems = (list: ICatalogItem[], depth: number) => {
    const nodes: React.ReactNode[] = [];
    for (const item of list) {
      const hasChildren = item.subCatalog && item.subCatalog.length > 0;
      const isCollapsed = collapsed.has(item.id);
      const isActive = item.id === activeId;
      const indent = 4 + depth * 10;

      nodes.push(
        <li key={item.id} style={{ paddingLeft: `${indent}px` }}>
          <div className="flex w-full items-center rounded-[2px] transition-colors hover:bg-black/[0.04]">
            {hasChildren ? (
              <button
                type="button"
                title={isCollapsed ? '展开' : '折叠'}
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapse(item.id)}
                className="mr-0.5 flex h-4 w-3.5 shrink-0 items-center justify-center"
              >
                <ChevronDown
                  size={11}
                  className={`shrink-0 text-[#8f959e] transition-transform ${
                    isCollapsed ? '-rotate-90' : ''
                  }`}
                />
              </button>
            ) : (
              levelToNumber(item.level) <= 2 && (
                <span className="mr-0.5 inline-block h-3.5 w-3.5 shrink-0" />
              )
            )}
            <button
              type="button"
              title={item.name}
              onClick={() => jumpTo(item)}
              className={`min-w-0 flex-1 truncate py-[3px] pr-1 text-left transition-colors ${textStyle(item.level)} ${
                isActive ? 'font-medium' : 'text-[#1f2329] hover:text-[#2a5fc9]'
              }`}
              style={isActive ? { color: ACTIVE_COLOR } : undefined}
            >
              {item.name}
            </button>
          </div>
        </li>,
      );

      if (hasChildren && !isCollapsed) {
        nodes.push(...renderItems(item.subCatalog, depth + 1));
      }
    }
    return nodes;
  };

  return (
    <div className="no-print flex h-full flex-col bg-[#f5f6f7] pl-[15px]">
      {/* 面板头：目录 + 浮层关闭按钮 */}
      <div className="flex h-9 shrink-0 items-center justify-between pl-2.5 pr-1.5">
        <span className="text-[13px] font-bold text-[#1f2329]">目录</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="收起目录"
            aria-label="收起目录"
            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-[#51565f] transition-colors hover:bg-black/[0.08]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {docTitle && (
          <div
            className="truncate px-2.5 pb-1.5 pt-0.5 text-[13px] font-semibold text-[#1f2329]"
            title={docTitle}
          >
            {docTitle}
          </div>
        )}
        {items.length === 0 ? (
          <p className="px-2.5 text-[12px] leading-[17px] text-[#767c85]">
            暂无标题，可通过工具栏"正文"下拉将段落设为标题
          </p>
        ) : (
          <ul className="pr-1.5">{renderItems(items, 0)}</ul>
        )}
      </div>
    </div>
  );
}

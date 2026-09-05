// 微信文档（企业微信 Word 在线编辑）风格工具栏：与顶部标题栏合并为单行、居中显示；
// 宽度不足时按组折叠按钮到组尾"⋯"面板（对齐参考 UI 的响应式折叠行为）；
// 暂无对应功能的按钮（拼音指南/字符缩放/字符间距/字体设置/缩进/高亮块）以禁用态占位；
// 上下标/拼音指南/字符缩放/字符间距放在对齐方式之后
// Task 2.3：插入/列表/标题/下划线样式/段落设置/菜单 已迁移到 canvas-editor API
// Task 2.4：格式刷 + 清除格式 已迁移到 canvas-editor API（executePainter / executeFormat）
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Editor from '@hufe921/canvas-editor';
import type { RowFlex } from '@hufe921/canvas-editor';
import { ListType, ListStyle } from '@hufe921/canvas-editor';
import { computeOverflowBuckets, type OverflowBucket } from './toolbarOverflow';
import { FontFamilySelect } from './FontFamilySelect';
import { FontSizeSelect } from './FontSizeSelect';
import { HeadingSelect, readLevelFromRange } from './HeadingSelect';
import { LineHeightSelect } from './LineHeightSelect';
import { UnderlineStyleSelect, readUnderlineStyleFromRange } from './UnderlineStyleSelect';
import { AlignSelect } from './AlignSelect';
import { InsertDropdown } from './InsertDropdown';
import { ColorPicker } from './ColorPicker';
import { WordIconButton, ToolbarDivider } from './ToolButton';
import { useFormatPainter } from '../../hooks/useFormatPainter';
import { useEditorStore } from '../../store/editorStore';
import { ToolbarMenu } from './ToolbarMenu';
import {
  WordUndoIcon,
  WordRedoIcon,
  WordFormatPaintIcon,
  WordClearFormatIcon,
  WordFontIncreaseIcon,
  WordFontDecreaseIcon,
  WordBoldIcon,
  WordItalicIcon,
  WordUnderlineIcon,
  WordStrikeIcon,
  WordSubIcon,
  WordSupIcon,
  WordPhoneticIcon,
  WordFontScalingIcon,
  WordLetterSpacingIcon,
  WordFontSettingsIcon,
  WordBulletListIcon,
  WordNumberedListIcon,
  WordTaskListIcon,
  WordIndentDecreaseIcon,
  WordIndentIncreaseIcon,
  WordQuoteIcon,
  WordHighlightBlockIcon,
  WordMoreIcon,
} from '../../components/icons/wordIcons';

interface ToolbarProps {
  editor: Editor | null;
}

/** 工具栏槽位：key 用于宽度测量与折叠计算，collapsible=false 的槽位永不折叠 */
interface Slot {
  key: string;
  node: React.ReactNode;
  collapsible?: boolean;
}

/** 功能暂缺的禁用占位按钮 */
function Placeholder({
  icon,
  label,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
}) {
  return <WordIconButton icon={icon} label={`${label}（开发中）`} onClick={() => {}} disabled />;
}

/**
 * 底纹颜色：canvas-editor 没有对应命令，仅本地 state 维护图标下色条的视觉反馈；
 * 以独立包装隔离本地 UI 状态，保持 ColorPicker 自身的纯受控语义
 */
function ShadingColorPicker() {
  const [color, setColor] = useState<string | null>(null);
  return (
    <ColorPicker
      mode="shading"
      value={color}
      onSelect={(c) => setColor(c)}
      onDefault={() => setColor(null)}
    />
  );
}


function OverflowBar({
  items,
  open,
}: {
  items: Slot[];
  open: boolean;
}) {
  if (!open || items.length === 0) return null;
  return (
    <div
      data-overflow-ui=""
      className="mt-0.5 inline-flex w-max max-w-full flex-wrap items-center rounded-md border border-black/[0.08] bg-white px-1 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
      role="toolbar"
    >
      {items.map(({ key, node }) => (
        <div key={key} className="flex shrink-0 items-center">
          {node}
        </div>
      ))}
    </div>
  );
}

/** 主栏组尾 ⋯：toggle 对应 overflow bucket（非 portal） */
function OverflowMoreButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-overflow-ui=""
      onClick={onToggle}
      title="更多"
      aria-label="更多"
      aria-expanded={open}
      className={`mx-px flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] transition-colors ${
        open ? 'bg-black/[0.08]' : 'hover:bg-black/[0.08]'
      }`}
    >
      <WordMoreIcon className="h-[18px] w-[18px]" />
    </button>
  );
}

export function Toolbar({ editor }: ToolbarProps) {
  const { rangeStyle } = useEditorStore();

  const {
    mode: painterMode,
    onPainterClick,
    onPainterDoubleClick,
    onPainterMouseDown,
  } = useFormatPainter(editor);

  // 引用：canvas-editor 无 blockquote API（spec 偏差），active 态永远为 false
  const inQuote = false;

  // 列表状态：从 rangeStyle 获取
  const listType = rangeStyle?.listType ?? null;
  const listStyle = rangeStyle?.listStyle ?? null;
  const inBullet = listType === ListType.UL && listStyle !== ListStyle.CHECKBOX;
  const inOrdered = listType === ListType.OL;
  const inTask = listType === ListType.UL && listStyle === ListStyle.CHECKBOX;

  const painterTitle =
    painterMode !== 'off'
      ? '格式刷(使用中，Esc 退出)'
      : '格式刷(双击可连续使用)';

  const containerRef = useRef<HTMLDivElement>(null);
  const slotEls = useRef(new Map<string, HTMLDivElement>());
  const slotWidths = useRef(new Map<string, number>());
  const [containerWidth, setContainerWidth] = useState(0);
  const [, setMeasureVersion] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [openBucketIds, setOpenBucketIds] = useState<Set<OverflowBucket['id']>>(
    () => new Set(),
  );
  const prevViewportWidthRef = useRef(viewportWidth);

  // 监听容器宽度变化（窗口缩放 / 布局变化时重新计算折叠）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    // jsdom 等测试环境无 ResizeObserver，降级为 window resize 监听
    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => setContainerWidth(el.clientWidth);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 视口跨 1200 时关闭所有次级条（宽/窄分桶规则切换）
  useEffect(() => {
    const prev = prevViewportWidthRef.current;
    const crossed =
      (prev < 1200 && viewportWidth >= 1200) || (prev >= 1200 && viewportWidth < 1200);
    prevViewportWidthRef.current = viewportWidth;
    if (crossed) setOpenBucketIds(new Set());
  }, [viewportWidth]);

  useEffect(() => {
    if (openBucketIds.size === 0) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('[data-overflow-ui]')) return;
      setOpenBucketIds(new Set());
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openBucketIds]);

  const setSlotRef = (key: string) => (el: HTMLDivElement | null) => {
    if (el) slotEls.current.set(key, el);
  };

  // 渲染后测量各槽位实际宽度（首次全量可见时测量；折叠后沿用已记录宽度）
  // 仅在容器宽度变化时重新测量，避免每次渲染都遍历 DOM
  useLayoutEffect(() => {
    let changed = false;
    slotEls.current.forEach((el, key) => {
      const w = el.offsetWidth;
      if (w > 0 && slotWidths.current.get(key) !== w) {
        slotWidths.current.set(key, w);
        changed = true;
      }
    });
    if (changed) setMeasureVersion((v) => v + 1);
  }, [containerWidth]);

  // 列表 toggle：canvas-editor 中再次调用相同列表类型即取消
  const toggleList = (kind: 'bullet' | 'ordered' | 'task') => {
    if (!editor) return;
    switch (kind) {
      case 'bullet':
        if (inBullet) {
          editor.command.executeList(null);
        } else {
          editor.command.executeList(ListType.UL, ListStyle.DISC);
        }
        break;
      case 'ordered':
        if (inOrdered) {
          editor.command.executeList(null);
        } else {
          editor.command.executeList(ListType.OL, ListStyle.DECIMAL);
        }
        break;
      case 'task':
        if (inTask) {
          editor.command.executeList(null);
        } else {
          editor.command.executeList(ListType.UL, ListStyle.CHECKBOX);
        }
        break;
    }
  };

  const groups: Slot[][] = [
    // 文件菜单（不折叠）
    [{ key: 'file-menu', node: <ToolbarMenu editor={editor} /> }],
    // 撤销/重做/格式刷/清除格式
    [
      {
        key: 'undo',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordUndoIcon}
            label="撤销"
            disabled={!rangeStyle?.undo}
            onClick={() => editor?.command.executeUndo()}
          />
        ),
      },
      {
        key: 'redo',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordRedoIcon}
            label="重做"
            disabled={!rangeStyle?.redo}
            onClick={() => editor?.command.executeRedo()}
          />
        ),
      },
      {
        key: 'format-paint',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordFormatPaintIcon}
            label={painterTitle}
            onClick={onPainterClick}
            onDoubleClick={onPainterDoubleClick}
            onMouseDown={onPainterMouseDown}
            active={painterMode !== 'off'}
          />
        ),
      },
      {
        key: 'clear-format',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordClearFormatIcon}
            label="清除格式"
            // canvas-editor executeFormat 清除当前选区的所有内联样式
            onClick={() => editor?.command.executeFormat()}
          />
        ),
      },
    ],
    // 插入（下拉）
    [
      { key: 'insert', collapsible: true, node: <InsertDropdown editor={editor} /> },
    ],
    // 标题 / 字体 / 字号 / 增减字号
    [
      {
        key: 'heading',
        collapsible: true,
        node: (
          <HeadingSelect
            editor={editor}
            level={readLevelFromRange(rangeStyle)}
          />
        ),
      },
      {
        key: 'font-family',
        collapsible: true,
        node: (
          <FontFamilySelect
            value={rangeStyle?.font ?? 'Microsoft YaHei'}
            onChange={(font) => editor?.command.executeFont(font)}
          />
        ),
      },
      {
        key: 'font-size',
        collapsible: true,
        node: (
          <FontSizeSelect
            value={rangeStyle?.size ?? 16}
            onChange={(size) => editor?.command.executeSize(size)}
          />
        ),
      },
      {
        key: 'font-increase',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordFontIncreaseIcon}
            label="增大字号"
            onClick={() => editor?.command.executeSizeAdd()}
          />
        ),
      },
      {
        key: 'font-decrease',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordFontDecreaseIcon}
            label="减小字号"
            onClick={() => editor?.command.executeSizeMinus()}
          />
        ),
      },
    ],
    // 文字格式
    [
      {
        key: 'bold',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordBoldIcon}
            label="加粗"
            onClick={() => editor?.command.executeBold()}
            active={rangeStyle?.bold ?? false}
          />
        ),
      },
      {
        key: 'italic',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordItalicIcon}
            label="倾斜"
            onClick={() => editor?.command.executeItalic()}
            active={rangeStyle?.italic ?? false}
          />
        ),
      },
      {
        key: 'underline',
        collapsible: true,
        node: (
          <div className="flex shrink-0 items-center">
            <WordIconButton
              icon={WordUnderlineIcon}
              label="下划线"
              onClick={() => editor?.command.executeUnderline()}
              active={rangeStyle?.underline ?? false}
            />
            <UnderlineStyleSelect
              editor={editor}
              currentStyle={readUnderlineStyleFromRange(rangeStyle)}
            />
          </div>
        ),
      },
      {
        key: 'strike',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordStrikeIcon}
            label="删除线"
            onClick={() => editor?.command.executeStrikeout()}
            active={rangeStyle?.strikeout ?? false}
          />
        ),
      },
    ],
    // 高亮 / 底纹 / 字体颜色 / 字体设置
    [
      {
        key: 'highlight',
        collapsible: true,
        node: (
          <ColorPicker
            mode="highlight"
            value={rangeStyle?.highlight ?? null}
            onSelect={(color) => editor?.command.executeHighlight(color)}
            onDefault={() => editor?.command.executeHighlight(null)}
          />
        ),
      },
      { key: 'shading', collapsible: true, node: <ShadingColorPicker /> },
      {
        key: 'font-color',
        collapsible: true,
        node: (
          <ColorPicker
            mode="color"
            value={rangeStyle?.color ?? null}
            onSelect={(color) => editor?.command.executeColor(color)}
            onDefault={() => editor?.command.executeColor(null)}
          />
        ),
      },
      { key: 'font-settings', collapsible: true, node: <Placeholder icon={WordFontSettingsIcon} label="字体设置" /> },
    ],
    // 列表 / 缩进 / 对齐 / 上下标·字符 / 行距 / 引用 / 高亮块 / 段落设置
    [
      {
        key: 'bullet-list',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordBulletListIcon}
            label="项目符号"
            onClick={() => toggleList('bullet')}
            active={inBullet}
          />
        ),
      },
      {
        key: 'numbered-list',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordNumberedListIcon}
            label="数字编号"
            onClick={() => toggleList('ordered')}
            active={inOrdered}
          />
        ),
      },
      {
        key: 'task-list',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordTaskListIcon}
            label="待办事项"
            onClick={() => toggleList('task')}
            active={inTask}
          />
        ),
      },
      { key: 'indent-decrease', collapsible: true, node: <Placeholder icon={WordIndentDecreaseIcon} label="减少缩进" /> },
      { key: 'indent-increase', collapsible: true, node: <Placeholder icon={WordIndentIncreaseIcon} label="增加缩进" /> },
      {
        key: 'align',
        collapsible: true,
        node: (
          <AlignSelect
            value={(rangeStyle?.rowFlex ?? 'left') as RowFlex}
            onChange={(flex) => editor?.command.executeRowFlex(flex)}
          />
        ),
      },
      {
        key: 'sub',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordSubIcon}
            label="下标"
            onClick={() => editor?.command.executeSubscript()}
            active={rangeStyle?.type === 'subscript'}
          />
        ),
      },
      {
        key: 'sup',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordSupIcon}
            label="上标"
            onClick={() => editor?.command.executeSuperscript()}
            active={rangeStyle?.type === 'superscript'}
          />
        ),
      },
      { key: 'phonetic', collapsible: true, node: <Placeholder icon={WordPhoneticIcon} label="拼音指南" /> },
      { key: 'font-scaling', collapsible: true, node: <Placeholder icon={WordFontScalingIcon} label="字符缩放" /> },
      { key: 'letter-spacing', collapsible: true, node: <Placeholder icon={WordLetterSpacingIcon} label="字符间距" /> },
      {
        key: 'line-height',
        collapsible: true,
        node: (
          <LineHeightSelect
            value={rangeStyle?.rowMargin ?? 1}
            onChange={(margin) => editor?.command.executeRowMargin(margin)}
          />
        ),
      },
      {
        // canvas-editor 无 blockquote API（spec 偏差）—— 禁用占位
        key: 'quote',
        collapsible: true,
        node: (
          <WordIconButton
            icon={WordQuoteIcon}
            label="引用"
            // canvas-editor 无 blockquote API（spec 偏差）→ 点击不触发任何操作
            onClick={() => {
              /* noop */
            }}
            disabled
            active={inQuote}
          />
        ),
      },
      { key: 'highlight-block', collapsible: true, node: <Placeholder icon={WordHighlightBlockIcon} label="高亮块" /> },
    ],
  ];

  const { hiddenKeys, buckets } = computeOverflowBuckets(
    groups,
    containerWidth - 8,
    slotWidths.current,
    viewportWidth,
  );

  const slotByKey = new Map<string, Slot>();
  for (const group of groups) {
    for (const slot of group) {
      slotByKey.set(slot.key, slot);
    }
  }

  const toggleBucket = (id: OverflowBucket['id']) => {
    setOpenBucketIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="relative min-w-0 flex-1">
        <div
          ref={containerRef}
          className="flex w-full items-center justify-center whitespace-nowrap"
        >
          {groups.map((group, gi) => {
            const visible = group.filter((s) => !hiddenKeys.has(s.key));
            const bucketHere = buckets.find((b) => b.anchorGroupIndex === gi);
            return (
              <Fragment key={`group-${gi}`}>
                {gi > 0 && <ToolbarDivider />}
                {visible.map(({ key, node }) => (
                  <div key={key} ref={setSlotRef(key)} className="flex shrink-0 items-center">
                    {node}
                  </div>
                ))}
                {bucketHere && (
                  <div className="relative shrink-0" data-overflow-ui="">
                    <OverflowMoreButton
                      open={openBucketIds.has(bucketHere.id)}
                      onToggle={() => toggleBucket(bucketHere.id)}
                    />
                    <div className="absolute right-0 top-full z-[10000]">
                      <OverflowBar
                        items={bucketHere.keys
                          .map((key) => slotByKey.get(key))
                          .filter((slot): slot is Slot => slot != null)}
                        open={openBucketIds.has(bucketHere.id)}
                      />
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RowFlex, NumberType } from '@hufe921/canvas-editor';
import { X } from 'lucide-react';
import { FONT_SIZES } from '../../components/toolbar/FontSizeSelect';
import { ColorPicker as StandaloneColorPicker } from '../../components/color';
import { useUIStore } from '../../store/uiStore';

/** 与 FontFamilySelect 同源，该文件未导出常量 */
const FONTS = [
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '华文宋体', value: 'STSong' },
  { label: '华文黑体', value: 'STHeiti' },
  { label: '华文仿宋', value: 'STFangsong' },
  { label: '华文楷体', value: 'STKaiti' },
  { label: '华文琥珀', value: 'STHupo' },
  { label: '华文隶书', value: 'STLiti' },
  { label: '华文新魏', value: 'STXinwei' },
  { label: '华文行楷', value: 'STXingkai' },
  { label: '华文中宋', value: 'STZhongsong' },
  { label: '华文彩云', value: 'STCaiyun' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '楷体', value: 'KaiTi' },
  { label: '仿宋', value: 'FangSong' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Segoe UI', value: 'Segoe UI' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Ink Free', value: 'Ink Free' },
  { label: 'Fantasy', value: 'Fantasy' },
];

/** 与 LineHeightSelect 同源，该文件未导出常量 */
const LINE_HEIGHTS = ['1', '1.25', '1.3', '1.5', '1.75', '2', '2.5', '3'];

const SELECT_CLS =
  'w-full rounded border border-[#e7e9eb] bg-white px-2 py-1.5 text-[13px] text-[#1f2329] outline-none focus:border-[#3370ff]';
const INPUT_CLS =
  'w-full rounded border border-[#e7e9eb] px-2 py-1.5 text-[13px] text-[#1f2329] outline-none focus:border-[#3370ff]';
const CHECKBOX_CLS = 'mr-2 h-4 w-4 rounded border-[#e7e9eb] text-[#3370ff] focus:ring-[#3370ff]';

function matchFontValue(css: string): string {
  return FONTS.find((f) => css.includes(f.value))?.value ?? FONTS[0].value;
}

function parsePx(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// 页码格式预设 — 占位符与 canvas-editor FORMAT_PLACEHOLDER 一致
const PAGE_NUMBER_FORMATS = [
  { label: '1, 2, 3...', value: '{pageNo}' },
  { label: '第 1 页', value: '第{pageNo}页' },
  { label: '第 1 页/共 10 页', value: '第{pageNo}页/共{pageCount}页' },
  { label: '1/10', value: '{pageNo}/{pageCount}' },
  { label: '- 1 -', value: '- {pageNo} -' },
];

/** 与顶部字体颜色组件同源的行内颜色选择按钮 */
function InlineColorButton({
  value,
  onChange,
  storageKey,
}: {
  value: string;
  onChange: (color: string) => void;
  storageKey: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setRect(null);
  }, []);

  // 点击外部关闭：需要同时检查 wrapper 和 portal 容器
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inWrapper = wrapperRef.current?.contains(target);
      const inPortal = portalRef.current?.contains(target);
      if (!inWrapper && !inPortal) {
        close();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const handleClick = () => {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  };

  const handleSelect = (color: string, options?: { close?: boolean }) => {
    onChange(color);
    // 调色板选择时关闭，高级面板预览时不关闭
    if (options?.close !== false) {
      close();
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        className="flex h-[32px] w-full items-center gap-2 rounded border border-[#e7e9eb] bg-white px-2 text-[13px] text-[#1f2329] hover:border-[#8f959e]"
      >
        <span
          className="h-4 w-4 shrink-0 rounded border border-[#e7e9eb]"
          style={{ backgroundColor: value }}
        />
        <span className="flex-1 text-left">{value}</span>
      </button>
      {open && rect &&
        createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              zIndex: 100001,
            }}
          >
            <StandaloneColorPicker
              open={open}
              onOpenChange={close}
              value={value}
              recentStorageKey={storageKey}
              onSelect={handleSelect}
              onDefault={() => onChange('#000000')}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

type TabId = 'general' | 'header' | 'footer' | 'pageNumber';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'general', label: '常规' },
  { id: 'header', label: '页眉' },
  { id: 'footer', label: '页脚' },
  { id: 'pageNumber', label: '页码' },
];

export function EditorSettingsModal() {
  const {
    editorPrefs,
    margin,
    settingsFocus,
    headerConfig,
    footerConfig,
    pageNumberConfig,
    setEditorPrefs,
    setMarginCustom,
    setHeaderConfig,
    setFooterConfig,
    setPageNumberConfig,
    setSettingsOpen,
  } = useUIStore();

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (settingsFocus === 'margin') return 'general';
    return (settingsFocus as TabId) || 'general';
  });

  const [fontFamily, setFontFamily] = useState(() => matchFontValue(editorPrefs.fontFamily));
  const [fontSize, setFontSize] = useState(editorPrefs.fontSize);
  const [lineHeight, setLineHeight] = useState(editorPrefs.lineHeight);
  const [top, setTop] = useState(margin.top);
  const [right, setRight] = useState(margin.right);
  const [bottom, setBottom] = useState(margin.bottom);
  const [left, setLeft] = useState(margin.left);

  // 页眉状态
  const [headerEnabled, setHeaderEnabled] = useState(headerConfig.enabled);
  const [headerContent, setHeaderContent] = useState(headerConfig.content);
  const [headerFontSize, setHeaderFontSize] = useState(headerConfig.fontSize);
  const [headerFont] = useState(headerConfig.font);
  const [headerColor, setHeaderColor] = useState(headerConfig.color);
  const [headerAlign, setHeaderAlign] = useState<RowFlex>(headerConfig.rowFlex);

  // 页脚状态
  const [footerEnabled, setFooterEnabled] = useState(footerConfig.enabled);
  const [footerContent, setFooterContent] = useState(footerConfig.content);
  const [footerFontSize, setFooterFontSize] = useState(footerConfig.fontSize);
  const [footerFont] = useState(footerConfig.font);
  const [footerColor, setFooterColor] = useState(footerConfig.color);
  const [footerAlign, setFooterAlign] = useState<RowFlex>(footerConfig.rowFlex);

  // 页码状态
  const [pageNumberEnabled, setPageNumberEnabled] = useState(pageNumberConfig.enabled);
  const [pageNumberFormat, setPageNumberFormat] = useState(pageNumberConfig.format);
  const [pageNumberSize, setPageNumberSize] = useState(pageNumberConfig.size);
  const [pageNumberFont] = useState(pageNumberConfig.font);
  const [pageNumberColor, setPageNumberColor] = useState(pageNumberConfig.color);
  const [pageNumberAlign, setPageNumberAlign] = useState<RowFlex>(pageNumberConfig.rowFlex);
  const [pageNumberType, setPageNumberType] = useState<NumberType>(pageNumberConfig.numberType);
  const [startPageNo, setStartPageNo] = useState(pageNumberConfig.startPageNo);
  const [fromPageNo, setFromPageNo] = useState(pageNumberConfig.fromPageNo);

  const initialMargin = useRef({
    top: margin.top,
    right: margin.right,
    bottom: margin.bottom,
    left: margin.left,
  });

  const close = () => setSettingsOpen(false);

  const apply = () => {
    setEditorPrefs({ fontFamily, fontSize, lineHeight });
    const next = { top, right, bottom, left };
    const prev = initialMargin.current;
    const marginChanged =
      next.top !== prev.top ||
      next.right !== prev.right ||
      next.bottom !== prev.bottom ||
      next.left !== prev.left;
    if (marginChanged) {
      setMarginCustom(next);
    }

    // 应用页眉配置
    setHeaderConfig({
      enabled: headerEnabled,
      content: headerContent,
      fontSize: headerFontSize,
      font: headerFont,
      color: headerColor,
      rowFlex: headerAlign,
    });

    // 应用页脚配置
    setFooterConfig({
      enabled: footerEnabled,
      content: footerContent,
      fontSize: footerFontSize,
      font: footerFont,
      color: footerColor,
      rowFlex: footerAlign,
    });

    // 应用页码配置
    setPageNumberConfig({
      enabled: pageNumberEnabled,
      format: pageNumberFormat,
      size: pageNumberSize,
      font: pageNumberFont,
      color: pageNumberColor,
      rowFlex: pageNumberAlign,
      numberType: pageNumberType,
      startPageNo,
      fromPageNo,
    });

    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={close}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="编辑器设置"
        tabIndex={-1}
        autoFocus
        className="flex h-[600px] w-[650px] flex-col rounded-md border border-[#e7e9eb] bg-white shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-[#e7e9eb] px-4 py-3">
          <div className="text-[14px] font-medium text-[#1f2329]">编辑器设置</div>
          <button
            type="button"
            onClick={close}
            title="关闭"
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded text-[#8f959e] hover:bg-[#f2f3f4] hover:text-[#1f2329]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab 栏 */}
        <div className="flex gap-1 border-b border-[#e7e9eb] px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-[13px] ${
                activeTab === tab.id
                  ? 'border-b-2 border-[#3370ff] text-[#1f2329]'
                  : 'text-[#8f959e] hover:text-[#1f2329]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'general' && (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] text-[#8f959e]">默认字体</span>
                <select
                  className={SELECT_CLS}
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                >
                  {FONTS.map((f) => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] text-[#8f959e]">默认字号</span>
                <select
                  className={SELECT_CLS}
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] text-[#8f959e]">默认行距</span>
                <select
                  className={SELECT_CLS}
                  value={lineHeight}
                  onChange={(e) => setLineHeight(e.target.value)}
                >
                  {LINE_HEIGHTS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <div className="mb-2 text-[12px] text-[#8f959e]">页边距（px）</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#8f959e]">上</span>
                    <input
                      type="number"
                      min={0}
                      value={top}
                      onChange={(e) => setTop(parsePx(e.target.value))}
                      className={INPUT_CLS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#8f959e]">右</span>
                    <input
                      type="number"
                      min={0}
                      value={right}
                      onChange={(e) => setRight(parsePx(e.target.value))}
                      className={INPUT_CLS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#8f959e]">下</span>
                    <input
                      type="number"
                      min={0}
                      value={bottom}
                      onChange={(e) => setBottom(parsePx(e.target.value))}
                      className={INPUT_CLS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#8f959e]">左</span>
                    <input
                      type="number"
                      min={0}
                      value={left}
                      onChange={(e) => setLeft(parsePx(e.target.value))}
                      className={INPUT_CLS}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'header' && (
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="header-enabled"
                  checked={headerEnabled}
                  onChange={(e) => setHeaderEnabled(e.target.checked)}
                  className={CHECKBOX_CLS}
                />
                <label htmlFor="header-enabled" className="text-[13px] text-[#1f2329]">
                  启用页眉
                </label>
              </div>
              {headerEnabled && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#8f959e]">页眉内容</span>
                    <input
                      type="text"
                      value={headerContent}
                      onChange={(e) => setHeaderContent(e.target.value)}
                      className={INPUT_CLS}
                      placeholder="输入页眉文字"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">字号</span>
                      <input
                        type="number"
                        min={8}
                        max={72}
                        value={headerFontSize}
                        onChange={(e) => setHeaderFontSize(parsePx(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">对齐</span>
                      <select
                        className={SELECT_CLS}
                        value={headerAlign}
                        onChange={(e) => setHeaderAlign(e.target.value as RowFlex)}
                      >
                        <option value={RowFlex.LEFT}>左对齐</option>
                        <option value={RowFlex.CENTER}>居中</option>
                        <option value={RowFlex.RIGHT}>右对齐</option>
                      </select>
                    </label>
                  </div>
                  <div>
                    <div className="mb-1 text-[12px] text-[#8f959e]">颜色</div>
                    <InlineColorButton
                      value={headerColor}
                      onChange={setHeaderColor}
                      storageKey="eflink-word:settings:header-color"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'footer' && (
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="footer-enabled"
                  checked={footerEnabled}
                  onChange={(e) => setFooterEnabled(e.target.checked)}
                  className={CHECKBOX_CLS}
                />
                <label htmlFor="footer-enabled" className="text-[13px] text-[#1f2329]">
                  启用页脚
                </label>
              </div>
              {footerEnabled && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#8f959e]">页脚内容</span>
                    <input
                      type="text"
                      value={footerContent}
                      onChange={(e) => setFooterContent(e.target.value)}
                      className={INPUT_CLS}
                      placeholder="输入页脚文字"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">字号</span>
                      <input
                        type="number"
                        min={8}
                        max={72}
                        value={footerFontSize}
                        onChange={(e) => setFooterFontSize(parsePx(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">对齐</span>
                      <select
                        className={SELECT_CLS}
                        value={footerAlign}
                        onChange={(e) => setFooterAlign(e.target.value as RowFlex)}
                      >
                        <option value={RowFlex.LEFT}>左对齐</option>
                        <option value={RowFlex.CENTER}>居中</option>
                        <option value={RowFlex.RIGHT}>右对齐</option>
                      </select>
                    </label>
                  </div>
                  <div>
                    <div className="mb-1 text-[12px] text-[#8f959e]">颜色</div>
                    <InlineColorButton
                      value={footerColor}
                      onChange={setFooterColor}
                      storageKey="eflink-word:settings:footer-color"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'pageNumber' && (
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pagenumber-enabled"
                  checked={pageNumberEnabled}
                  onChange={(e) => setPageNumberEnabled(e.target.checked)}
                  className={CHECKBOX_CLS}
                />
                <label htmlFor="pagenumber-enabled" className="text-[13px] text-[#1f2329]">
                  启用页码
                </label>
              </div>
              {pageNumberEnabled && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#8f959e]">页码格式</span>
                    <select
                      className={SELECT_CLS}
                      value={pageNumberFormat}
                      onChange={(e) => setPageNumberFormat(e.target.value)}
                    >
                      {PAGE_NUMBER_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">字号</span>
                      <input
                        type="number"
                        min={8}
                        max={72}
                        value={pageNumberSize}
                        onChange={(e) => setPageNumberSize(parsePx(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">对齐</span>
                      <select
                        className={SELECT_CLS}
                        value={pageNumberAlign}
                        onChange={(e) => setPageNumberAlign(e.target.value as RowFlex)}
                      >
                        <option value={RowFlex.LEFT}>左对齐</option>
                        <option value={RowFlex.CENTER}>居中</option>
                        <option value={RowFlex.RIGHT}>右对齐</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">数字类型</span>
                      <select
                        className={SELECT_CLS}
                        value={pageNumberType}
                        onChange={(e) => setPageNumberType(e.target.value as NumberType)}
                      >
                        <option value={NumberType.ARABIC}>阿拉伯数字 (1, 2, 3)</option>
                        <option value={NumberType.CHINESE}>中文数字 (一，二，三)</option>
                      </select>
                    </label>
                    <div>
                      <div className="mb-1 text-[12px] text-[#8f959e]">颜色</div>
                      <InlineColorButton
                        value={pageNumberColor}
                        onChange={setPageNumberColor}
                        storageKey="eflink-word:settings:pagenumber-color"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">起始页码</span>
                      <input
                        type="number"
                        min={1}
                        value={startPageNo}
                        onChange={(e) => setStartPageNo(parsePx(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8f959e]">从第几页开始显示</span>
                      <input
                        type="number"
                        min={1}
                        value={fromPageNo + 1}
                        onChange={(e) => setFromPageNo(Math.max(0, parsePx(e.target.value) - 1))}
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 border-t border-[#e7e9eb] px-4 py-3">
          <button
            type="button"
            onClick={close}
            className="rounded px-3 py-1.5 text-[13px] text-[#41464f] hover:bg-[#f2f3f4]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded bg-[#3370ff] px-3 py-1.5 text-[13px] text-white hover:bg-[#2860e1]"
          >
            应用
          </button>
        </div>
      </div>
    </div>
  );
}

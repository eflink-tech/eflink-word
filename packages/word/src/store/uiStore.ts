import { create } from 'zustand';
import { RowFlex, NumberType } from '@hufe921/canvas-editor';

// 与旧系统一致的纸张尺寸（宽*高，px @96dpi）
export interface PaperSize {
  label: string;
  width: number;
  height: number;
}

export const PAPER_SIZES: PaperSize[] = [
  { label: 'A4', width: 794, height: 1123 },
  { label: 'A3', width: 1125, height: 1593 },
  { label: 'A5', width: 565, height: 796 },
  { label: 'A2', width: 1593, height: 2251 },
  { label: '法律用纸', width: 813, height: 1266 },
  { label: '信纸', width: 813, height: 1054 },
];

// 页边距预设（上/右/下/左）
export interface PageMargin {
  label: string;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const MARGIN_PRESETS: PageMargin[] = [
  { label: '标准', top: 96, right: 120, bottom: 96, left: 120 },
  { label: '窄', top: 48, right: 64, bottom: 48, left: 64 },
  { label: '适中', top: 96, right: 96, bottom: 96, left: 96 },
  { label: '宽', top: 144, right: 144, bottom: 144, left: 144 },
];

export type SettingsFocus = 'general' | 'margin' | 'header' | 'footer' | 'pageNumber';

export interface EditorPrefs {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  spellcheck: boolean;
}

export const DEFAULT_EDITOR_PREFS: EditorPrefs = {
  fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif",
  fontSize: '16px',
  lineHeight: '1.3',
  spellcheck: false,
};

// 页眉/页脚配置
export interface HeaderFooterConfig {
  enabled: boolean;
  content: string;
  fontSize: number;
  font: string;
  color: string;
  rowFlex: RowFlex;
}

// 页码配置
export interface PageNumberConfig {
  enabled: boolean;
  format: string;
  size: number;
  font: string;
  color: string;
  rowFlex: RowFlex;
  numberType: NumberType;
  startPageNo: number;
  fromPageNo: number;
}

export const DEFAULT_HEADER_CONFIG: HeaderFooterConfig = {
  enabled: false,
  content: '',
  fontSize: 12,
  font: 'Microsoft YaHei',
  color: '#8f959e',
  rowFlex: RowFlex.CENTER,
};

export const DEFAULT_FOOTER_CONFIG: HeaderFooterConfig = {
  enabled: false,
  content: '',
  fontSize: 12,
  font: 'Microsoft YaHei',
  color: '#8f959e',
  rowFlex: RowFlex.CENTER,
};

export const DEFAULT_PAGE_NUMBER_CONFIG: PageNumberConfig = {
  enabled: true,
  format: '第{pageNo}页/共{pageCount}页',
  size: 12,
  font: 'Microsoft YaHei',
  color: '#8f959e',
  rowFlex: RowFlex.CENTER,
  numberType: NumberType.ARABIC,
  startPageNo: 1,
  // canvas-editor 使用 0 索引物理页：0 = 从第 1 页起显示页码
  fromPageNo: 0,
};

interface UIState {
  commentPanelOpen: boolean;
  viewMode: 'page' | 'continuous';
  zoom: number;
  paperSize: PaperSize;
  paperDirection: 'vertical' | 'horizontal';
  margin: PageMargin;
  watermark: string | null;
  searchPanelOpen: boolean;
  catalogOpen: boolean;
  settingsOpen: boolean;
  settingsFocus: SettingsFocus;
  editorPrefs: EditorPrefs;
  headerConfig: HeaderFooterConfig;
  footerConfig: HeaderFooterConfig;
  pageNumberConfig: PageNumberConfig;
  /** 右侧 AI 助手面板开关 */
  aiPanelOpen: boolean;

  toggleComment: () => void;
  setViewMode: (mode: 'page' | 'continuous') => void;
  setZoom: (zoom: number) => void;
  zoomReset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setPaperSize: (label: string) => void;
  setPaperDirection: (dir: 'vertical' | 'horizontal') => void;
  setMarginPreset: (label: string) => void;
  setMarginCustom: (m: { top: number; right: number; bottom: number; left: number }) => void;
  setWatermark: (text: string | null) => void;
  setSearchPanelOpen: (open: boolean) => void;
  toggleCatalog: () => void;
  setSettingsOpen: (open: boolean, focus?: SettingsFocus) => void;
  setEditorPrefs: (partial: Partial<EditorPrefs>) => void;
  setHeaderConfig: (config: Partial<HeaderFooterConfig>) => void;
  setFooterConfig: (config: Partial<HeaderFooterConfig>) => void;
  setPageNumberConfig: (config: Partial<PageNumberConfig>) => void;
  toggleAIPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  commentPanelOpen: false,
  viewMode: 'page',
  zoom: 100,
  paperSize: PAPER_SIZES[0],
  paperDirection: 'vertical',
  margin: MARGIN_PRESETS[0],
  watermark: null,
  searchPanelOpen: false,
  catalogOpen: true,
  settingsOpen: false,
  settingsFocus: 'general',
  editorPrefs: { ...DEFAULT_EDITOR_PREFS },
  headerConfig: { ...DEFAULT_HEADER_CONFIG },
  footerConfig: { ...DEFAULT_FOOTER_CONFIG },
  pageNumberConfig: { ...DEFAULT_PAGE_NUMBER_CONFIG },
  aiPanelOpen: false,

  toggleComment: () => set((state) => ({ commentPanelOpen: !state.commentPanelOpen })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 50), 200) }),
  zoomReset: () => set({ zoom: 100 }),
  zoomIn: () => set((state) => ({ zoom: Math.min(state.zoom + 10, 200) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(state.zoom - 10, 50) })),
  setPaperSize: (label) =>
    set((state) => {
      const paperSize = PAPER_SIZES.find((p) => p.label === label);
      return paperSize ? { paperSize } : state;
    }),
  setPaperDirection: (dir) => set({ paperDirection: dir }),
  setMarginPreset: (label) =>
    set((state) => {
      const margin = MARGIN_PRESETS.find((m) => m.label === label);
      return margin ? { margin } : state;
    }),
  setMarginCustom: (m) => set({ margin: { label: '自定义', ...m } }),
  setWatermark: (text) => set({ watermark: text && text.trim() ? text.trim() : null }),
  setSearchPanelOpen: (open) => set({ searchPanelOpen: open }),
  toggleCatalog: () => set((state) => ({ catalogOpen: !state.catalogOpen })),
  setSettingsOpen: (open, focus) =>
    set((state) => ({
      settingsOpen: open,
      settingsFocus: focus ?? state.settingsFocus,
    })),
  setEditorPrefs: (partial) =>
    set((state) => ({ editorPrefs: { ...state.editorPrefs, ...partial } })),
  setHeaderConfig: (config) =>
    set((state) => ({ headerConfig: { ...state.headerConfig, ...config } })),
  setFooterConfig: (config) =>
    set((state) => ({ footerConfig: { ...state.footerConfig, ...config } })),
  setPageNumberConfig: (config) =>
    set((state) => ({ pageNumberConfig: { ...state.pageNumberConfig, ...config } })),
  toggleAIPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
}));

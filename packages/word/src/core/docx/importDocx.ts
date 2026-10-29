/**
 * 收编自 @hufe921/canvas-editor-plugin-docx（MIT License）
 * 上游: https://github.com/Hufe921/canvas-editor-plugin
 * 收编版本: commit 7b630c1c8afdbf3d63f94f2ea5b9e69b2da60b04（2026-09-12）
 * 除本文件头外仅做计划列出的定点适配，保持与上游一致便于 diff。
 */
import type { Command, IElement, IEditorData } from '@hufe921/canvas-editor'
import {
  ElementType,
  RowFlex,
  VerticalAlign,
  ListType,
  ListStyle,
  TitleLevel,
  ImageDisplay,
  TdBorder,
  TableBorder,
  TextDecorationStyle,
  ControlType
} from '@hufe921/canvas-editor'
import JSZip from 'jszip'
import { OfficeError } from '@eflink-tech/office-kit'
import { wordT } from '../../i18n/runtime'
import { measureFontMetrics, parseDocxNumber } from './docxUtils'
import { DEFAULT_TABLE_ROW_MIN_HEIGHT } from '../canvas-editor/editor-instance'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeImportDocx(options: IImportDocxOption): void
  }
}

export interface IImportDocxOption {
  arrayBuffer: ArrayBuffer
  // 追加模式：导入内容插入到当前文档末尾，不覆盖已有内容（#36）
  isAppend?: boolean
}

// 单位换算：1px = 15twip = 9525EMU；docx 字号为半磅
const TWIP_PER_PX = 15
const EMU_PER_PX = 9525

// 元素子节点（Element.children 在部分 DOM 实现中不可用，统一走 childNodes）
function elementChildren(element: Element): Element[] {
  const children: Element[] = []
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i]
    if (node.nodeType === 1) children.push(node as Element)
  }
  return children
}

function twipToPx(twip: number): number {
  return Math.round(twip / TWIP_PER_PX)
}

function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX)
}

function halfPointToPx(halfPoint: number): number {
  return Math.round((halfPoint * 2) / 3)
}

// docx 命名高亮色 -> hex
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#FFFF00',
  green: '#00FF00',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  blue: '#0000FF',
  red: '#FF0000',
  darkBlue: '#00008B',
  darkCyan: '#008B8B',
  darkGreen: '#006400',
  darkMagenta: '#8B008B',
  darkRed: '#8B0000',
  darkYellow: '#808000',
  darkGray: '#A9A9A9',
  lightGray: '#D3D3D3',
  black: '#000000',
  white: '#FFFFFF'
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  tiff: 'image/tiff'
}

const TITLE_LEVELS: TitleLevel[] = [
  TitleLevel.FIRST,
  TitleLevel.SECOND,
  TitleLevel.THIRD,
  TitleLevel.FOURTH,
  TitleLevel.FIFTH,
  TitleLevel.SIXTH
]

// ====================================================================
// 工具函数
// =====================================================================

// 解析 rels（word/_rels/xxx.xml.rels）：内部 rId -> zip 路径 / 外部 rId -> url
async function readRels(
  zip: JSZip,
  relsPath: string
): Promise<{
  internal: Map<string, string>
  external: Map<string, string>
}> {
  const internal = new Map<string, string>()
  const external = new Map<string, string>()
  const relsFile = zip.file(relsPath)
  if (!relsFile) return { internal, external }
  const dom = new DOMParser().parseFromString(
    await relsFile.async('text'),
    'application/xml'
  )
  const baseDir = relsPath.replace(/_rels\/[^/]+$/, '')
  for (const rel of Array.from(dom.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target') || ''
    if (!id || !target) continue
    if (rel.getAttribute('TargetMode') === 'External') {
      external.set(id, target)
    } else {
      internal.set(
        id,
        decodeURIComponent(
          new URL(target, 'http://localhost/' + baseDir).pathname.slice(1)
        )
      )
    }
  }
  return { internal, external }
}

// 无 extent 的图片按字节嗅探原始尺寸（PNG/GIF/BMP/JPEG）
function sniffImageSize(
  bytes: Uint8Array
): { width: number; height: number } | null {
  const be16 = (o: number) => (bytes[o] << 8) | bytes[o + 1]
  const le16 = (o: number) => bytes[o] | (bytes[o + 1] << 8)
  const be32 = (o: number) =>
    ((bytes[o] << 24) |
      (bytes[o + 1] << 16) |
      (bytes[o + 2] << 8) |
      bytes[o + 3]) >>>
    0
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: be32(16), height: be32(20) }
  }
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) {
    return { width: le16(6), height: le16(8) }
  }
  if (bytes.length > 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return {
      width: bytes[18] | (bytes[19] << 8) | (bytes[20] << 16),
      height: bytes[22] | (bytes[23] << 8) | (bytes[24] << 16)
    }
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = bytes[offset + 1]
      const length = be16(offset + 2)
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      if (isSof) {
        return { height: be16(offset + 5), width: be16(offset + 7) }
      }
      offset += 2 + length
    }
  }
  return null
}

// 行内样式（docx rPr 的可继承子集）
// 开关型属性保留三态：undefined=继承，false=显式关闭（覆盖样式链）
interface RunStyle {
  verticalType?: 'superscript' | 'subscript'
  fontAscii?: string
  fontEastAsia?: string
  size?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  underlineStyle?: TextDecorationStyle
  strikeout?: boolean
  color?: string
  highlight?: string
  letterSpacing?: number
  caps?: boolean
  smallCaps?: boolean
  hidden?: boolean
}

// 主题色/主题字体（word/theme/theme1.xml）
interface ThemeContext {
  colors: Map<string, string>
  fonts: Map<string, string>
}

const EMPTY_THEME: ThemeContext = { colors: new Map(), fonts: new Map() }

function isOn(value: string | null): boolean {
  return value !== null && value !== '0' && value !== 'false' && value !== 'off'
}

// w:b 等开关元素：缺失返回 undefined，存在时按 val 解析
function readToggle(rPr: Element, tag: string): boolean | undefined {
  const element = rPr.getElementsByTagName(tag)[0]
  if (!element) return undefined
  const val = element.getAttribute('w:val')
  return val === null ? true : isOn(val)
}

function normalizeColor(value: string | null): string | undefined {
  if (!value || value === 'auto') return undefined
  const hex = value.replace('#', '').slice(-6).toUpperCase()
  return /^[0-9A-F]{6}$/.test(hex) ? `#${hex}` : undefined
}

// themeColor 名称 -> clrScheme 槽位
const THEME_COLOR_SLOT: Record<string, string> = {
  dark1: 'dk1',
  light1: 'lt1',
  dark2: 'dk2',
  light2: 'lt2',
  text1: 'dk1',
  background1: 'lt1',
  text2: 'dk2',
  background2: 'lt2',
  hyperlink: 'hlink',
  followedHyperlink: 'folHlink'
}

// themeTint/themeShade：Word 用 0-255 的十六进制串，向白混合/整体压暗
function applyThemeTint(
  hex: string,
  tint: string | null,
  shade: string | null
): string {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const tintRatio = tint ? parseInt(tint, 16) / 255 : 0
  const shadeRatio = shade ? parseInt(shade, 16) / 255 : 1
  const out = channels.map(ch => {
    const shaded = ch * shadeRatio
    return Math.round(shaded + (255 - shaded) * tintRatio)
  })
  return `#${out.map(ch => ch.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function resolveColor(
  value: string | null,
  theme: ThemeContext,
  tint: string | null = null,
  shade: string | null = null
): string | undefined {
  if (!value || value === 'auto') return undefined
  const direct = normalizeColor(value)
  if (direct) {
    return tint || shade ? applyThemeTint(direct, tint, shade) : direct
  }
  const slot = THEME_COLOR_SLOT[value] || value
  const base = theme.colors.get(slot)
  if (!base) return undefined
  return tint || shade ? applyThemeTint(base, tint, shade) : base
}

function themeFont(
  theme: ThemeContext,
  themeName: string | null
): string | undefined {
  if (!themeName) return undefined
  if (themeName.includes('EastAsia')) {
    return theme.fonts.get(
      themeName.startsWith('major') ? 'majorEa' : 'minorEa'
    )
  }
  return theme.fonts.get(
    themeName.startsWith('major') ? 'majorLatin' : 'minorLatin'
  )
}

const UNDERLINE_STYLES: Record<string, TextDecorationStyle> = {
  double: TextDecorationStyle.DOUBLE,
  dotted: TextDecorationStyle.DOTTED,
  dottedHeavy: TextDecorationStyle.DOTTED,
  dash: TextDecorationStyle.DASHED,
  dashed: TextDecorationStyle.DASHED,
  dashHeavy: TextDecorationStyle.DASHED,
  longDash: TextDecorationStyle.DASHED,
  longDashHeavy: TextDecorationStyle.DASHED,
  wavy: TextDecorationStyle.WAVY,
  wavyHeavy: TextDecorationStyle.WAVY,
  wavyDouble: TextDecorationStyle.WAVY
}

function parseRPr(rPr: Element | null, theme: ThemeContext): RunStyle {
  const style: RunStyle = {}
  if (!rPr) return style
  const bold = readToggle(rPr, 'w:b')
  if (bold !== undefined) style.bold = bold
  const italic = readToggle(rPr, 'w:i')
  if (italic !== undefined) style.italic = italic
  const underlineElement = rPr.getElementsByTagName('w:u')[0]
  if (underlineElement) {
    const underline = underlineElement.getAttribute('w:val') || 'single'
    if (underline === 'none') {
      style.underline = false
    } else {
      style.underline = true
      style.underlineStyle = UNDERLINE_STYLES[underline] || TextDecorationStyle.SOLID
    }
  }
  const strikeout = readToggle(rPr, 'w:strike')
  if (strikeout !== undefined) style.strikeout = strikeout
  const colorElement = rPr.getElementsByTagName('w:color')[0]
  const color = resolveColor(
    // val 缺失时使用 themeColor 槽位（Word 常只写主题色）
    (colorElement?.getAttribute('w:val') &&
    colorElement.getAttribute('w:val') !== 'auto'
      ? colorElement.getAttribute('w:val')
      : colorElement?.getAttribute('w:themeColor')) || null,
    theme,
    colorElement?.getAttribute('w:themeTint') ?? null,
    colorElement?.getAttribute('w:themeShade') ?? null
  )
  if (color) style.color = color
  const highlight = rPr
    .getElementsByTagName('w:highlight')[0]
    ?.getAttribute('w:val')
  if (highlight && HIGHLIGHT_COLORS[highlight]) {
    style.highlight = HIGHLIGHT_COLORS[highlight]
  } else {
    // Word 高亮也常用 run 底纹（w:shd）存储
    const shdFill = normalizeColor(
      rPr.getElementsByTagName('w:shd')[0]?.getAttribute('w:fill') ?? null
    )
    if (shdFill && shdFill !== '#FFFFFF') {
      style.highlight = shdFill
    }
  }
  // 字号：优先 w:sz，缺失时回退 w:szCs（中文 Word/WPS 常只写 szCs）
  const sizeElement = rPr.getElementsByTagName('w:sz')[0]
  const sizeCsElement = rPr.getElementsByTagName('w:szCs')[0]
  const sizeVal =
    parseDocxNumber(sizeElement?.getAttribute('w:val')) ||
    parseDocxNumber(sizeCsElement?.getAttribute('w:val'))
  if (sizeVal) style.size = halfPointToPx(sizeVal)
  const fonts = rPr.getElementsByTagName('w:rFonts')[0]
  const eastAsia =
    fonts?.getAttribute('w:eastAsia') ||
    themeFont(theme, fonts?.getAttribute('w:eastAsiaTheme') ?? null)
  const ascii =
    fonts?.getAttribute('w:ascii') ||
    fonts?.getAttribute('w:hAnsi') ||
    themeFont(theme, fonts?.getAttribute('w:asciiTheme') ?? null) ||
    themeFont(theme, fonts?.getAttribute('w:hAnsiTheme') ?? null)
  if (eastAsia) style.fontEastAsia = eastAsia
  if (ascii) style.fontAscii = ascii
  const vertAlign = rPr
    .getElementsByTagName('w:vertAlign')[0]
    ?.getAttribute('w:val')
  if (vertAlign === 'superscript') style.verticalType = 'superscript'
  else if (vertAlign === 'subscript') style.verticalType = 'subscript'
  // 字符间距：twip（1/20 pt）-> px
  const spacing = parseDocxNumber(
    rPr.getElementsByTagName('w:spacing')[0]?.getAttribute('w:val')
  )
  if (spacing) style.letterSpacing = round2(spacing / 15)
  const caps = readToggle(rPr, 'w:caps')
  if (caps !== undefined) style.caps = caps
  const smallCaps = readToggle(rPr, 'w:smallCaps')
  if (smallCaps !== undefined) style.smallCaps = smallCaps
  const hidden = readToggle(rPr, 'w:vanish')
  if (hidden !== undefined) style.hidden = hidden
  return style
}

function mergeStyle(...layers: RunStyle[]): RunStyle {
  return Object.assign({}, ...layers)
}

function fontOf(style: RunStyle): string | undefined {
  return style.fontEastAsia || style.fontAscii
}

// 内部样式字段 -> 编辑器元素样式（字体按东亚字体优先取单一字体）
function toElementStyle(style: RunStyle): Record<string, unknown> {
  const font = fontOf(style)
  return {
    ...(font ? { font } : {}),
    ...(style.size ? { size: style.size } : {}),
    ...(style.bold !== undefined ? { bold: style.bold } : {}),
    ...(style.italic !== undefined ? { italic: style.italic } : {}),
    ...(style.underline !== undefined ? { underline: style.underline } : {}),
    ...(style.underlineStyle && style.underline
      ? { textDecoration: { style: style.underlineStyle } }
      : {}),
    ...(style.strikeout !== undefined ? { strikeout: style.strikeout } : {}),
    ...(style.color ? { color: style.color } : {}),
    ...(style.highlight ? { highlight: style.highlight } : {}),
    ...(style.letterSpacing ? { letterSpacing: style.letterSpacing } : {})
  }
}

// 区域上下文：图片/超链接关系按所在 xml 的 rels 解析
interface ZoneContext {
  rels: {
    internal: Map<string, string>
    external: Map<string, string>
  }
  // 所在区域：页脚中的 PAGE/NUMPAGES 域转换为编辑器页码配置
  zone?: 'main' | 'header' | 'footer'
}

// docx 边框类型 -> 编辑器分隔线（dashArray 为 Canvas 虚线段格式）
function buildSeparator(
  borderType: string,
  sz: number,
  color?: string
): IElement {
  const dashArrayMap: Record<string, number[]> = {
    dashed: [4, 2],
    dotted: [1, 3],
    dashDot: [4, 2, 1, 2],
    dashDotDot: [4, 2, 1, 2],
    dotDash: [4, 2, 1, 2]
  }
  // w:sz 单位 1/8 pt -> px
  const lineWidth = sz ? Math.max(1, Math.round(sz / 6)) : undefined
  return {
    value: '\n',
    type: ElementType.SEPARATOR,
    ...(dashArrayMap[borderType]
      ? { dashArray: dashArrayMap[borderType] }
      : {}),
    ...(lineWidth ? { lineWidth } : {}),
    ...(color ? { color } : {})
  }
}

// VML shape style（pt）-> px
function style2WidthHeight(
  shape: Element | undefined
): {
  width?: number
  height?: number
} {
  if (!shape) return {}
  const style = shape.getAttribute('style') || ''
  const widthPt = Number(style.match(/width:([\d.]+)pt/)?.[1] || 0)
  const heightPt = Number(style.match(/height:([\d.]+)pt/)?.[1] || 0)
  return {
    ...(widthPt ? { width: Math.round((widthPt * 4) / 3) } : {}),
    ...(heightPt ? { height: Math.round((heightPt * 4) / 3) } : {})
  }
}

// 判断元素是否含实际内容（文本/图片/表格/控件/超链接等）
function hasActualContent(elements: IElement[] | undefined): boolean {
  if (!elements) return false
  for (const el of elements) {
    if (el.type === ElementType.TABLE) {
      if (
        (el.trList || []).some(tr =>
          tr.tdList.some(td => hasActualContent(td.value))
        )
      ) {
        return true
      }
    } else if (el.valueList?.length) {
      if (hasActualContent(el.valueList)) return true
    } else if (el.control?.value?.length) {
      if (hasActualContent(el.control.value)) return true
    } else if (el.checkbox || el.radio) {
      return true
    } else if (el.value && el.value !== '\n') {
      return true
    } else if (
      el.type &&
      el.type !== ElementType.TEXT &&
      el.type !== ElementType.SEPARATOR
    ) {
      return true
    }
  }
  return false
}

// 水印尺寸 clamp：超出页面时等比缩小（编辑器按原尺寸绘制，超大图会溢出画布观感）
function clampWatermarkSize(
  width: number,
  height: number,
  maxPx: { width: number; height: number }
): { width: number; height: number } {
  const scale = Math.min(
    1,
    maxPx.width / Math.max(width, 1),
    maxPx.height / Math.max(height, 1)
  )
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  }
}

let controlIdSeq = 0
function generateControlId(): string {
  controlIdSeq += 1
  return `docx-control-${controlIdSeq}`
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// 去除元素列表末尾的冗余换行（单元格/页眉页脚的边界即行边界，
// 官方 setHTML 的块级补行只对非最后子节点生效，末尾段落无尾换行）
function trimTrailingBreaks(elementList: IElement[]): IElement[] {
  while (elementList.length) {
    const last = elementList[elementList.length - 1]
    if (
      last.type === ElementType.TABLE ||
      last.type === ElementType.IMAGE ||
      last.type === ElementType.SEPARATOR
    ) {
      // 表格/图片/分隔线自带断行语义，保留（页眉底线即分隔线）
      break
    }
    if (last.value === '\n') {
      elementList.pop()
      continue
    }
    if (last.type === ElementType.TEXT && last.value?.endsWith('\n')) {
      last.value = last.value.replace(/\n$/, '')
      if (!last.value) {
        elementList.pop()
      }
      continue
    }
    break
  }
  return elementList
}

function appendLineBreak(elements: IElement[], style: RunStyle) {
  const last = elements[elements.length - 1]
  if (last && last.type === ElementType.TEXT && last.value !== '\n') {
    last.value = `${last.value}\n`
  } else {
    elements.push({ value: '\n', type: ElementType.TEXT, ...toElementStyle(style) })
  }
}

// ====================================================================
// 页脚页码域（PAGE / NUMPAGES）-> 编辑器 pageNumber 配置
// =====================================================================

const PAGE_NO_TOKEN = '\u0001pageNo\u0001'
const PAGE_COUNT_TOKEN = '\u0001pageCount\u0001'

// 从页脚元素中提取页码域：占位符替换为 {pageNo}/{pageCount} 模板，
// 独占一行的页码域整行移除（由编辑器页码渲染），混合行仅去除占位符
function extractPageNumber(elements: IElement[]): {
  elements: IElement[]
  pageNumber?: Record<string, unknown>
} {
  const containsToken = (element: IElement) =>
    typeof element.value === 'string' &&
    (element.value.includes(PAGE_NO_TOKEN) ||
      element.value.includes(PAGE_COUNT_TOKEN))
  if (!elements.some(containsToken)) return { elements }
  const groups: IElement[][] = []
  let current: IElement[] = []
  for (const element of elements) {
    current.push(element)
    const endsLine =
      typeof element.value === 'string' && element.value.endsWith('\n')
    if (endsLine || element.type === ElementType.TABLE) {
      groups.push(current)
      current = []
    }
  }
  if (current.length) groups.push(current)
  let pageNumber: Record<string, unknown> | undefined
  const output: IElement[] = []
  groups.forEach((group, index) => {
    const tokenElements = group.filter(containsToken)
    if (!tokenElements.length) {
      output.push(...group)
      return
    }
    const format = group
      .map(element => (typeof element.value === 'string' ? element.value : ''))
      .join('')
      .replace(PAGE_NO_TOKEN, '{pageNo}')
      .replace(PAGE_COUNT_TOKEN, '{pageCount}')
      .replace(/\n$/, '')
      .trim()
    if (!pageNumber) {
      const anchor = tokenElements[0]
      const rowFlex = group.find(element => element.rowFlex)?.rowFlex
      pageNumber = {
        // 整行文本作为模板（含前后缀），由编辑器页码层渲染
        ...(format ? { format } : {}),
        ...(rowFlex ? { rowFlex } : {}),
        ...(anchor.size ? { size: anchor.size } : {}),
        ...(anchor.font ? { font: anchor.font } : {}),
        ...(anchor.color ? { color: anchor.color } : {})
      }
    }
    // 页码行由 pageNumber 渲染，保留行内非文本元素（图片等）
    const nonText = group.filter(element => element.type !== ElementType.TEXT)
    if (nonText.length) {
      output.push(...nonText)
      if (index < groups.length - 1) {
        output.push({ value: '\n', type: ElementType.TEXT, rowMargin: 0 })
      }
    } else if (index < groups.length - 1) {
      output.push({ value: '\n', type: ElementType.TEXT, rowMargin: 0 })
    }
  })
  return { elements: output, ...(pageNumber ? { pageNumber } : {}) }
}

// ====================================================================
// 段落样式（pPr 的可继承子集）与表格边框
// =====================================================================

// 段落属性三态同 RunStyle：仅记录显式声明，便于按样式链合并
interface PprProps {
  jc?: RowFlex
  line?: number
  lineRule?: string
  firstLineChars?: number
  firstLine?: number
  hangingChars?: number
  hanging?: number
  leftChars?: number
  left?: number
  numId?: string
  ilvl?: number
  outlineLvl?: number
}

function parsePpr(pPr: Element | null): PprProps {
  const props: PprProps = {}
  if (!pPr) return props
  const jc = pPr.getElementsByTagName('w:jc')[0]?.getAttribute('w:val')
  const alignMap: Record<string, RowFlex> = {
    left: RowFlex.LEFT,
    start: RowFlex.LEFT,
    center: RowFlex.CENTER,
    right: RowFlex.RIGHT,
    end: RowFlex.RIGHT,
    both: RowFlex.ALIGNMENT,
    distribute: RowFlex.ALIGNMENT
  }
  if (jc && alignMap[jc]) props.jc = alignMap[jc]
  const spacing = pPr.getElementsByTagName('w:spacing')[0]
  if (spacing) {
    const line = parseDocxNumber(spacing.getAttribute('w:line'))
    if (line > 0) {
      props.line = line
      props.lineRule = spacing.getAttribute('w:lineRule') || 'auto'
    }
  }
  const ind = pPr.getElementsByTagName('w:ind')[0]
  if (ind) {
    const indAttrs: [string, keyof PprProps][] = [
      ['w:firstLineChars', 'firstLineChars'],
      ['w:firstLine', 'firstLine'],
      ['w:hangingChars', 'hangingChars'],
      ['w:hanging', 'hanging'],
      ['w:leftChars', 'leftChars'],
      ['w:left', 'left']
    ]
    for (const [attr, key] of indAttrs) {
      const value = ind.getAttribute(attr)
      if (value !== null) {
        ;(props[key] as number) = parseDocxNumber(value)
      }
    }
  }
  const numPr = pPr.getElementsByTagName('w:numPr')[0]
  if (numPr) {
    const numId = numPr
      .getElementsByTagName('w:numId')[0]
      ?.getAttribute('w:val')
    const ilvl = numPr
      .getElementsByTagName('w:ilvl')[0]
      ?.getAttribute('w:val')
    if (numId !== undefined && numId !== null) props.numId = numId
    if (ilvl !== null && ilvl !== undefined) {
      props.ilvl = parseDocxNumber(ilvl)
    }
  }
  const outlineLvl = pPr
    .getElementsByTagName('w:outlineLvl')[0]
    ?.getAttribute('w:val')
  if (outlineLvl !== null && outlineLvl !== undefined) {
    props.outlineLvl = parseDocxNumber(outlineLvl)
  }
  return props
}

function mergePpr(...layers: (PprProps | undefined)[]): PprProps {
  const merged: PprProps = {}
  for (const layer of layers) {
    if (!layer) continue
    for (const key of Object.keys(layer) as (keyof PprProps)[]) {
      const value = layer[key]
      if (value !== undefined) {
        ;(merged[key] as unknown) = value
      }
    }
  }
  return merged
}

type TableBorderSide =
  | 'top'
  | 'left'
  | 'bottom'
  | 'right'
  | 'insideH'
  | 'insideV'

type TableBorders = Partial<Record<TableBorderSide, boolean>>

function parseTableBorders(
  bordersElement: Element | undefined
): TableBorders | undefined {
  if (!bordersElement) return undefined
  const borders: TableBorders = {}
  const sides: [string, TableBorderSide][] = [
    ['w:top', 'top'],
    ['w:left', 'left'],
    ['w:start', 'left'],
    ['w:bottom', 'bottom'],
    ['w:right', 'right'],
    ['w:end', 'right'],
    ['w:insideH', 'insideH'],
    ['w:insideV', 'insideV']
  ]
  let hasAny = false
  for (const [tag, side] of sides) {
    const element = bordersElement.getElementsByTagName(tag)[0]
    if (!element) continue
    const val = element.getAttribute('w:val') || ''
    borders[side] = !['nil', 'none'].includes(val)
    hasAny = true
  }
  return hasAny ? borders : undefined
}

// 无序列表项目符号：lvlText 的字形（Symbol/Wingdings 私用区）-> 编辑器样式
function bulletStyleOf(lvl: Element): ListStyle {
  const text =
    lvl.getElementsByTagName('w:lvlText')[0]?.getAttribute('w:val') || ''
  const font =
    lvl
      .getElementsByTagName('w:rPr')[0]
      ?.getElementsByTagName('w:rFonts')[0]
      ?.getAttribute('w:ascii') || ''
  if (text === 'o' || text === 'O' || text === '\u25CB' || text === '\u25E6') {
    return ListStyle.CIRCLE
  }
  if (
    font.toLowerCase().startsWith('wingdings') ||
    text === '§' ||
    text === '\u25AA' ||
    text === '\u25A0' ||
    text === '\uF0A7'
  ) {
    return ListStyle.SQUARE
  }
  return ListStyle.DISC
}

// 展开 OOXML 包装节点：修订插入/移动目标/自定义 XML 视为普通内容，
// 删除/移出修订与 AlternateContent 的 Fallback 不参与输出（避免重复）
const CONTENT_WRAPPER_TAGS = new Set([
  'w:ins',
  'w:moveTo',
  'w:customXml',
  'w:smartTag',
  'w:dir',
  'w:bdo',
  'w:subDoc'
])

function expandWrappers(container: Element): Element[] {
  const result: Element[] = []
  for (const child of elementChildren(container)) {
    const tag = child.tagName
    if (tag === 'w:del' || tag === 'w:moveFrom') continue
    if (tag === 'mc:AlternateContent') {
      const choice = elementChildren(child).find(el => el.tagName === 'mc:Choice')
      if (choice) result.push(...expandWrappers(choice))
      continue
    }
    if (CONTENT_WRAPPER_TAGS.has(tag)) {
      result.push(...expandWrappers(child))
      continue
    }
    result.push(child)
  }
  return result
}

interface FieldFrame {
  phase: 'instruction' | 'result'
  instruction: string
  result: IElement[]
  kind: 'hyperlink' | 'page' | 'pageCount' | 'form' | 'other'
  url?: string
}

function createFieldFrame(): FieldFrame {
  return { phase: 'instruction', instruction: '', result: [], kind: 'other' }
}

// 域指令：HYPERLINK "url" / PAGE / NUMPAGES（含 \* 开关）
function resolveField(frame: FieldFrame) {
  const instruction = frame.instruction.replace(/\s+/g, ' ').trim()
  if (/^HYPERLINK\b/i.test(instruction)) {
    const match = instruction.match(/^HYPERLINK\s+(?:"([^"]*)"|(\S+))/i)
    const url = match?.[1] || match?.[2]
    if (url) {
      frame.kind = 'hyperlink'
      frame.url = url
      return
    }
    frame.kind = 'other'
    return
  }
  if (/^PAGE\b/i.test(instruction)) {
    frame.kind = 'page'
    return
  }
  if (/^NUMPAGES\b/i.test(instruction)) {
    frame.kind = 'pageCount'
    return
  }
  frame.kind = 'other'
}

// ====================================================================
// OOXML -> 编辑器元素 解析器
// =====================================================================

class DocxParser {
  private zip: JSZip
  private headingByStyleId = new Map<string, TitleLevel>()
  private styleRPrById = new Map<string, RunStyle>()
  // 段落样式的 pPr（对齐/行距/缩进/大纲级别）与表格样式边框
  private pprByStyleId = new Map<string, PprProps>()
  private tableBordersByStyleId = new Map<string, TableBorders>()
  // numId -> 每级列表类型（null = 该级无编号标记，按普通段落处理）
  private listTypeByNumId = new Map<
    string,
    ({ listType: ListType; listStyle?: ListStyle } | null)[]
  >()
  private theme: ThemeContext = EMPTY_THEME
  private defaultRunStyle: RunStyle = {}
  // docDefaults / Normal 的 pPr，参与段落属性合并链
  private defaultPpr: PprProps = {}
  private defaultParagraphPpr: PprProps | null = null
  // 默认段落样式（Normal）的 rPr，参与样式合并链
  private defaultParagraphStyle: RunStyle | null = null
  // 目录样式（w:name "toc N"）styleId -> 层级
  private tocLevelByStyleId = new Map<string, number>()
  // 脚注/尾注正文（id -> 元素），仅在正文引用时输出
  private notes = {
    footnote: new Map<string, IElement[]>(),
    endnote: new Map<string, IElement[]>()
  }
  private noteOrder = { footnote: [] as string[], endnote: [] as string[] }
  private noteIndex = {
    footnote: new Map<string, number>(),
    endnote: new Map<string, number>()
  }
  // 图片缓存：zip 路径 -> dataUrl + 原始尺寸
  private imageCache = new Map<
    string,
    { dataUrl: string; size: { width: number; height: number } | null }
  >()
  // document.xml 的关系缓存（页眉/页脚/图片引用解析共用）
  private documentRels: {
    internal: Map<string, string>
    external: Map<string, string>
  } | null = null

  constructor(zip: JSZip) {
    this.zip = zip
  }

  private async getDocumentRels() {
    if (!this.documentRels) {
      this.documentRels = await readRels(
        this.zip,
        'word/_rels/document.xml.rels'
      )
    }
    return this.documentRels
  }

  async parse(): Promise<
    IEditorData & {
      watermark?: object
      pageSetup?: object
      pageNumber?: object
      zoneOffsets?: { headerTop?: number; footerBottom?: number }
      disabledPages?: { header?: number[]; footer?: number[] }
    }
  > {
    await this.parseTheme()
    await this.parseStyles()
    await this.parseNumbering()
    const docFile = this.zip.file('word/document.xml')
    if (!docFile) {
      throw new OfficeError('word.error.docxInvalid', 'missing word/document.xml')
    }
    const docDom = new DOMParser().parseFromString(
      await docFile.async('text'),
      'application/xml'
    )
    if (docDom.getElementsByTagName('parsererror').length) {
      throw new OfficeError('word.error.docxInvalid', 'malformed document.xml')
    }
    const ctx: ZoneContext = { rels: await this.getDocumentRels() }
    // 先批量读取图片（两阶段：文件异步读取完成后再同步遍历 DOM）
    await this.cacheImages()
    await this.parseNotes()
    const body = docDom.getElementsByTagName('w:body')[0]
    // 纸张/边距/方向 + 默认字体字号（先解析，供水印尺寸 clamp）
    const pageSetup = this.parsePageSetup(body)
    const pageSetupRecord = (pageSetup || {}) as Record<string, unknown>
    const maxWatermarkPx = {
      width: ((pageSetupRecord.width as number) || 794) * 0.95,
      height: ((pageSetupRecord.height as number) || 1123) * 0.95
    }
    const main = body ? this.parseBlockContainer(body, ctx) : []
    main.push(...this.buildNotesSection())
    // 页眉页脚：取 body 级 sectPr（最后一个）的 default 引用
    const emptyZone: {
      elements: IElement[]
      watermark?: object
      pageNumber?: object
    } = {
      elements: []
    }
    const header = body
      ? await this.parseZone('header', body, maxWatermarkPx)
      : Promise.resolve(emptyZone)
    const footer = body
      ? await this.parseZone('footer', body, maxWatermarkPx)
      : Promise.resolve(emptyZone)
    const [headerResult, footerResult] = await Promise.all([header, footer])
    // 页眉/页脚始终传键：编辑器 setEditorData 对未传 zone 保留旧数据，
    // 导入语义为整体替换，空页眉/页脚需显式传空数组清空。
    // 封面节页眉/页脚为空时（多节文档），编辑器首页禁用对应区域
    const disabledPages: { header?: number[]; footer?: number[] } = {}
    if (
      headerResult.elements.length &&
      (await this.isFirstZoneEmpty('header', body))
    ) {
      disabledPages.header = [0]
    }
    if (
      footerResult.elements.length &&
      (await this.isFirstZoneEmpty('footer', body))
    ) {
      disabledPages.footer = [0]
    }
    const zoneOffsets = this.parseZoneOffsets(body)
    return {
      header: headerResult.elements,
      main,
      footer: footerResult.elements,
      ...(headerResult.watermark ? { watermark: headerResult.watermark } : {}),
      ...(pageSetup ? { pageSetup } : {}),
      ...(footerResult.pageNumber ? { pageNumber: footerResult.pageNumber } : {}),
      ...(zoneOffsets ? { zoneOffsets } : {}),
      ...(Object.keys(disabledPages).length ? { disabledPages } : {})
    }
  }

  // 页眉/页脚距边距离（twip -> px）
  private parseZoneOffsets(
    body: Element | null
  ): { headerTop?: number; footerBottom?: number } | undefined {
    const sectPrs = body?.getElementsByTagName('w:sectPr')
    const sectPr = sectPrs?.[sectPrs.length - 1]
    if (!sectPr) return undefined
    const offsets: { headerTop?: number; footerBottom?: number } = {}
    const header = sectPr.getElementsByTagName('w:header')[0]
    const footer = sectPr.getElementsByTagName('w:footer')[0]
    const top = parseDocxNumber(header?.getAttribute('w:top'))
    const bottom = parseDocxNumber(footer?.getAttribute('w:bottom'))
    if (top) offsets.headerTop = twipToPx(top)
    if (bottom) offsets.footerBottom = twipToPx(bottom)
    return Object.keys(offsets).length ? offsets : undefined
  }

  // body 级 sectPr 的纸张尺寸/方向/页边距 + 文档默认字体字号
  private parsePageSetup(body: Element | null): object | undefined {
    const setup: Record<string, unknown> = {}
    const sectPrs = body?.getElementsByTagName('w:sectPr')
    const sectPr = sectPrs?.[sectPrs.length - 1]
    const pgSz = sectPr?.getElementsByTagName('w:pgSz')[0]
    if (pgSz) {
      const width = twipToPx(parseDocxNumber(pgSz.getAttribute('w:w')))
      const height = twipToPx(parseDocxNumber(pgSz.getAttribute('w:h')))
      if (width && height) {
        setup.width = width
        setup.height = height
        setup.paperDirection =
          pgSz.getAttribute('w:orient') === 'landscape'
            ? 'horizontal'
            : 'vertical'
      }
    }
    const pgMar = sectPr?.getElementsByTagName('w:pgMar')[0]
    if (pgMar) {
      const top = twipToPx(parseDocxNumber(pgMar.getAttribute('w:top')))
      const right = twipToPx(parseDocxNumber(pgMar.getAttribute('w:right')))
      const bottom = twipToPx(parseDocxNumber(pgMar.getAttribute('w:bottom')))
      const left = twipToPx(parseDocxNumber(pgMar.getAttribute('w:left')))
      if (top && right && bottom && left) {
        setup.margins = [top, right, bottom, left]
      }
    }
    // 文档默认字体/字号（新输入内容跟随）：优先 Normal 默认段落样式（docDefaults 常无字号）
    const defaultFont =
      fontOf(this.defaultParagraphStyle || {}) || fontOf(this.defaultRunStyle)
    const defaultSize =
      this.defaultParagraphStyle?.size || this.defaultRunStyle.size
    if (defaultFont) {
      setup.defaultFont = defaultFont
    }
    if (defaultSize) {
      setup.defaultSize = defaultSize
    }
    return Object.keys(setup).length ? setup : undefined
  }

  // 批量读取 word/media 图片为 dataUrl 并嗅探原始尺寸
  private async cacheImages() {
    for (const path of Object.keys(this.zip.files)) {
      if (!path.startsWith('word/media/')) continue
      const ext = path.split('.').pop()?.toLowerCase() || ''
      const mime = MIME_BY_EXT[ext]
      if (!mime) continue
      const base64 = await this.zip.files[path].async('base64')
      const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))
      this.imageCache.set(path, {
        dataUrl: `data:${mime};base64,${base64}`,
        size: sniffImageSize(bytes)
      })
    }
  }

  // 主题：clrScheme（themeColor）与 fontScheme（asciiTheme/eastAsiaTheme）
  private async parseTheme() {
    const themePath = Object.keys(this.zip.files).find(path =>
      /^word\/theme\/[^/]+\.xml$/.test(path)
    )
    if (!themePath) return
    const dom = new DOMParser().parseFromString(
      await this.zip.files[themePath].async('text'),
      'application/xml'
    )
    if (dom.getElementsByTagName('parsererror').length) return
    const colors = new Map<string, string>()
    const clrScheme = dom.getElementsByTagName('a:clrScheme')[0]
    if (clrScheme) {
      for (const slot of elementChildren(clrScheme)) {
        const srgb = slot.getElementsByTagName('a:srgbClr')[0]
        const sys = slot.getElementsByTagName('a:sysClr')[0]
        const value = normalizeColor(
          srgb?.getAttribute('val') || sys?.getAttribute('lastClr') || null
        )
        if (value) colors.set(slot.tagName.replace('a:', ''), value)
      }
    }
    const fonts = new Map<string, string>()
    const fontScheme = dom.getElementsByTagName('a:fontScheme')[0]
    for (const [tag, prefix] of [
      ['a:majorFont', 'major'],
      ['a:minorFont', 'minor']
    ] as const) {
      const font = fontScheme?.getElementsByTagName(tag)[0]
      if (!font) continue
      const latin = font.getElementsByTagName('a:latin')[0]?.getAttribute('typeface')
      const eastAsia = font.getElementsByTagName('a:ea')[0]?.getAttribute('typeface')
      if (latin) fonts.set(`${prefix}Latin`, latin)
      if (eastAsia) fonts.set(`${prefix}Ea`, eastAsia)
    }
    this.theme = { colors, fonts }
  }

  // 样式表：docDefaults 默认字体字号、段落样式（标题级别映射 + basedOn 继承链）
  private async parseStyles() {
    const stylesFile = this.zip.file('word/styles.xml')
    if (!stylesFile) return
    const dom = new DOMParser().parseFromString(
      await stylesFile.async('text'),
      'application/xml'
    )
    const rPrDefault = dom.getElementsByTagName('w:rPrDefault')[0]
    if (rPrDefault) {
      this.defaultRunStyle = parseRPr(
        rPrDefault.getElementsByTagName('w:rPr')[0] || null,
        this.theme
      )
    }
    const pPrDefault = dom.getElementsByTagName('w:pPrDefault')[0]
    if (pPrDefault) {
      this.defaultPpr = parsePpr(
        pPrDefault.getElementsByTagName('w:pPr')[0] || null
      )
    }
    const basedOnById = new Map<string, string>()
    const rawRPrById = new Map<string, Element | null>()
    const rawPPrById = new Map<string, Element | null>()
    const rawTblBordersById = new Map<string, TableBorders>()
    const nameById = new Map<string, string>()
    for (const style of Array.from(dom.getElementsByTagName('w:style'))) {
      const id = style.getAttribute('w:styleId')
      if (!id) continue
      // 默认段落样式（Normal）：无 pStyle 段落的字号/字体/段落属性来源
      if (
        style.getAttribute('w:type') === 'paragraph' &&
        style.getAttribute('w:default') === '1' &&
        !this.defaultParagraphStyle
      ) {
        this.defaultParagraphStyle = parseRPr(
          style.getElementsByTagName('w:rPr')[0] || null,
          this.theme
        )
        this.defaultParagraphPpr = parsePpr(
          style.getElementsByTagName('w:pPr')[0] || null
        )
      }
      const name = style
        .getElementsByTagName('w:name')[0]
        ?.getAttribute('w:val')
        ?.toLowerCase()
      if (name) nameById.set(id, name)
      // 目录样式：w:name "toc N"
      const tocMatch = name?.match(/^toc (\d)$/)
      if (tocMatch) {
        this.tocLevelByStyleId.set(id, Number(tocMatch[1]))
      }
      const basedOn = style
        .getElementsByTagName('w:basedOn')[0]
        ?.getAttribute('w:val')
      if (basedOn) basedOnById.set(id, basedOn)
      rawRPrById.set(id, style.getElementsByTagName('w:rPr')[0] || null)
      rawPPrById.set(id, style.getElementsByTagName('w:pPr')[0] || null)
      const tblBorders = parseTableBorders(
        style.getElementsByTagName('w:tblPr')[0]?.getElementsByTagName('w:tblBorders')[0]
      )
      if (tblBorders) rawTblBordersById.set(id, tblBorders)
    }
    const resolveRPr = (id: string, depth = 0): RunStyle => {
      if (depth > 5) return {}
      const basedOn = basedOnById.get(id)
      const layers = basedOn ? [resolveRPr(basedOn, depth + 1)] : []
      layers.push(parseRPr(rawRPrById.get(id) ?? null, this.theme))
      return mergeStyle(...layers)
    }
    const resolvePpr = (id: string, depth = 0): PprProps => {
      if (depth > 5) return {}
      const basedOn = basedOnById.get(id)
      const layers = basedOn ? [resolvePpr(basedOn, depth + 1)] : []
      layers.push(parsePpr(rawPPrById.get(id) ?? null))
      return mergePpr(...layers)
    }
    const resolveTableBorders = (
      id: string,
      depth = 0
    ): TableBorders | undefined => {
      if (depth > 5) return undefined
      const own = rawTblBordersById.get(id)
      if (own) return own
      const basedOn = basedOnById.get(id)
      return basedOn ? resolveTableBorders(basedOn, depth + 1) : undefined
    }
    for (const id of Array.from(rawRPrById.keys())) {
      this.styleRPrById.set(id, resolveRPr(id))
      this.pprByStyleId.set(id, resolvePpr(id))
      const tableBorders = resolveTableBorders(id)
      if (tableBorders) this.tableBordersByStyleId.set(id, tableBorders)
      // 标题样式：w:name "heading N" 或（继承链解析后的）w:outlineLvl
      const name = nameById.get(id)
      const headingMatch = name?.match(/^heading (\d)$/)
      if (headingMatch) {
        this.headingByStyleId.set(id, TITLE_LEVELS[Number(headingMatch[1]) - 1])
        continue
      }
      const outlineLvl = this.pprByStyleId.get(id)?.outlineLvl
      if (outlineLvl !== undefined && outlineLvl >= 0 && outlineLvl < 6) {
        this.headingByStyleId.set(id, TITLE_LEVELS[outlineLvl])
      }
    }
  }

  // 编号：numId -> 各级 numFmt（bullet -> 无序列表，其余 -> 有序列表）
  private async parseNumbering() {
    const numberingFile = this.zip.file('word/numbering.xml')
    if (!numberingFile) return
    const dom = new DOMParser().parseFromString(
      await numberingFile.async('text'),
      'application/xml'
    )
    const levelListByAbstractId = new Map<
      string,
      ({ listType: ListType; listStyle?: ListStyle } | null)[]
    >()
    for (const abstractNum of Array.from(
      dom.getElementsByTagName('w:abstractNum')
    )) {
      // 仅直属层级（getElementsByTagName 会含嵌套）
      const lvlElements = elementChildren(abstractNum).filter(
        child => child.tagName === 'w:lvl'
      )
      const levels: ({ listType: ListType; listStyle?: ListStyle } | null)[] = []
      for (const lvl of lvlElements) {
        const numFmt = lvl
          .getElementsByTagName('w:numFmt')[0]
          ?.getAttribute('w:val') || 'decimal'
        if (numFmt === 'none') {
          levels.push(null)
          continue
        }
        if (numFmt === 'bullet') {
          levels.push({ listType: ListType.UL, listStyle: bulletStyleOf(lvl) })
        } else {
          levels.push({ listType: ListType.OL, listStyle: ListStyle.DECIMAL })
        }
      }
      levelListByAbstractId.set(
        abstractNum.getAttribute('w:abstractNumId') || '',
        levels
      )
    }
    for (const num of Array.from(dom.getElementsByTagName('w:num'))) {
      const numId = num.getAttribute('w:numId') || ''
      const abstractId = num
        .getElementsByTagName('w:abstractNumId')[0]
        ?.getAttribute('w:val')
      if (numId && abstractId) {
        this.listTypeByNumId.set(
          numId,
          levelListByAbstractId.get(abstractId) || []
        )
      }
    }
  }

  // 脚注/尾注：独立 XML 部件，仅在正文引用时输出（编辑器无原生脚注）
  private async parseNotes() {
    for (const kind of ['footnote', 'endnote'] as const) {
      const partPath =
        kind === 'footnote' ? 'word/footnotes.xml' : 'word/endnotes.xml'
      const file = this.zip.file(partPath)
      if (!file) continue
      const dom = new DOMParser().parseFromString(
        await file.async('text'),
        'application/xml'
      )
      if (dom.getElementsByTagName('parsererror').length) continue
      const rels = await readRels(
        this.zip,
        kind === 'footnote'
          ? 'word/_rels/footnotes.xml.rels'
          : 'word/_rels/endnotes.xml.rels'
      )
      const ctx: ZoneContext = { rels, zone: 'main' }
      for (const note of Array.from(
        dom.getElementsByTagName(`w:${kind}`)
      )) {
        const id = note.getAttribute('w:id') || ''
        // -1/0 为分隔符/续行分隔符，type 非 normal 的也跳过
        if (!id || id === '-1' || id === '0') continue
        const type = note.getAttribute('w:type')
        if (type && type !== 'normal') continue
        const content = trimTrailingBreaks(
          this.parseBlockContainer(note, ctx)
        )
        if (content.length) this.notes[kind].set(id, content)
      }
    }
  }

  // 追加脚注/尾注区（引用标记已内联，此处补正文）
  private buildNotesSection(): IElement[] {
    const additions: IElement[] = []
    for (const kind of ['footnote', 'endnote'] as const) {
      const order = this.noteOrder[kind]
      if (!order.length) continue
      const title = wordT(
        kind === 'footnote' ? 'word.import.footnotes' : 'word.import.endnotes'
      )
      additions.push({
        value: `${title}\n`,
        type: ElementType.TEXT,
        bold: true
      })
      for (const id of order) {
        const index = this.noteIndex[kind].get(id)
        const content = this.notes[kind].get(id)
        if (index === undefined || !content) continue
        const marker = `[${index}] `
        if (content.length && content[0].type === ElementType.TEXT) {
          content[0].value = `${marker}${content[0].value || ''}`
        } else {
          content.unshift({ value: marker, type: ElementType.TEXT })
        }
        additions.push(...content)
      }
    }
    return additions
  }

  // 脚注/尾注引用：编号按出现顺序分配，无对应正文时不输出
  private noteReferenceElement(kind: 'footnote' | 'endnote', id: string): IElement | null {
    const content = this.notes[kind].get(id)
    if (!content) return null
    let index = this.noteIndex[kind].get(id)
    if (index === undefined) {
      this.noteOrder[kind].push(id)
      index = this.noteOrder[kind].length
      this.noteIndex[kind].set(id, index)
    }
    return {
      value: `[${index}]`,
      type: ElementType.SUPERSCRIPT
    }
  }

  // 解析节引用的页眉/页脚 DOM 与 rels。
  // direction：'first' 取第一个带引用的节（封面判定）/ 'last' 取最后一个
  // （OOXML 节继承语义：未定义引用的节继承前一节，正文页眉页脚=最近的引用）。
  // 仅解析被引用的文件，不按文件名猜测——避免捞到未引用的遗留文件
  private async resolveZone(
    zone: 'header' | 'footer',
    body: Element,
    direction: 'first' | 'last'
  ): Promise<{ root: Element; rels: ZoneContext['rels'] } | null> {
    const sectPrs = body.getElementsByTagName('w:sectPr')
    const indexes = Array.from({ length: sectPrs.length }, (_, i) => i)
    const order = direction === 'first' ? indexes : indexes.reverse()
    for (const i of order) {
      const zoneReferences = Array.from(
        sectPrs[i].getElementsByTagName(`w:${zone}Reference`)
      )
      if (!zoneReferences.length) continue
      const reference =
        zoneReferences.find(r => r.getAttribute('w:type') === 'default') ||
        zoneReferences[0]
      const rId = reference?.getAttribute('r:id') || ''
      const zonePath = rId
        ? (await this.getDocumentRels()).internal.get(rId)
        : undefined
      const zoneFile = zonePath ? this.zip.file(zonePath) : null
      if (!zonePath || !zoneFile) return null
      const zoneDom = new DOMParser().parseFromString(
        await zoneFile.async('text'),
        'application/xml'
      )
      const root =
        zoneDom.getElementsByTagName(`w:${zone}`)[0] || zoneDom.documentElement
      const rels = await readRels(
        this.zip,
        `word/_rels/${zonePath.split('/').pop() || ''}.rels`
      )
      return { root, rels }
    }
    return null
  }

  // 判定第一节（文档开头）的页眉/页脚是否无实际内容
  private async isFirstZoneEmpty(
    zone: 'header' | 'footer',
    body: Element
  ): Promise<boolean> {
    const resolved = await this.resolveZone(zone, body, 'first')
    if (!resolved) return true
    return !hasActualContent(
      this.parseBlockContainer(resolved.root, { rels: resolved.rels })
    )
  }

  // 解析页眉/页脚为元素列表（header 可能携带 Word 水印）
  private async parseZone(
    zone: 'header' | 'footer',
    body: Element,
    maxWatermarkPx: { width: number; height: number }
  ): Promise<{ elements: IElement[]; watermark?: object; pageNumber?: object }> {
    const resolved = await this.resolveZone(zone, body, 'last')
    if (!resolved) return { elements: [] }
    const { root, rels } = resolved
    const parsed = trimTrailingBreaks(
      // 过滤完全无内容的装饰表格（WPS 页眉页脚的空三栏骨架）
      this.parseBlockContainer(root, { rels, zone }).filter(
        el =>
          el.type !== ElementType.TABLE ||
          (el.trList || []).some(tr =>
            tr.tdList.some(td => hasActualContent(td.value))
          )
      )
    )
    // Word 水印：header 中的 VML 文字/图片水印 shape、衬底浮动图片
    const watermark = this.parseWatermark(root, rels, maxWatermarkPx)
    // 已识别为水印的衬底大图不再保留在页眉内容中（避免双重）
    const withoutWatermark = watermark
      ? parsed.filter(
          el =>
            !(
              el.type === ElementType.IMAGE &&
              el.imgDisplay === ImageDisplay.FLOAT_BOTTOM &&
              (el.width || 0) >= 300
            )
        )
      : parsed
    // 页脚页码域 -> 编辑器 pageNumber 配置
    const pageNumberResult =
      zone === 'footer'
        ? extractPageNumber(withoutWatermark)
        : { elements: withoutWatermark }
    return {
      elements: pageNumberResult.elements,
      ...(watermark ? { watermark } : {}),
      ...('pageNumber' in pageNumberResult
        ? { pageNumber: pageNumberResult.pageNumber }
        : {})
    }
  }

  // Word 水印（v:shape 含 v:textpath 文字或 v:imagedata 图片，id 通常为
  // PowerPlusWaterMarkObject）-> 编辑器 watermark 配置
  private parseWatermark(
    root: Element,
    rels: { internal: Map<string, string> },
    maxPx: { width: number; height: number }
  ): object | undefined {
    // 图片水印：header 内衬于文字下方（behindDoc）的浮动图片
    for (const anchor of Array.from(root.getElementsByTagName('wp:anchor'))) {
      if (anchor.getAttribute('behindDoc') !== '1') continue
      const blip = anchor.getElementsByTagName('a:blip')[0]
      const rId = blip?.getAttribute('r:embed') || ''
      const path = rels.internal.get(rId)
      const cached = path ? this.imageCache.get(path) : null
      if (!cached) continue
      const extent = anchor.getElementsByTagName('wp:extent')[0]
      const width = emuToPx(Number(extent?.getAttribute('cx') || 0))
      const height = emuToPx(Number(extent?.getAttribute('cy') || 0))
      // 图片水印：宽度超过内容区一半的衬底图
      if (width < 300) continue
      const clamped = clampWatermarkSize(width, height, maxPx)
      return {
        type: 'image',
        data: cached.dataUrl,
        width: clamped.width,
        height: clamped.height,
        layer: 'bottom'
      }
    }
    for (const pict of Array.from(root.getElementsByTagName('w:pict'))) {
      const shape = pict.getElementsByTagName('v:shape')[0]
      if (!shape) continue
      const shapeId = shape.getAttribute('id') || ''
      const textPath = shape.getElementsByTagName('v:textpath')[0]
      const imageData = shape.getElementsByTagName('v:imagedata')[0]
      const isWatermarkShape =
        textPath ||
        /watermark/i.test(shapeId) ||
        (shape.getElementsByTagName('v:fill').length > 0 &&
          !!shape.getAttribute('o:allowincell'))
      if (textPath) {
        const data = textPath.getAttribute('string') || ''
        if (!data) continue
        // Word 水印 shape 的 font-size 恒为 1pt（fitshape 拉伸渲染），
        // 实际字形高 ≈ shape 高 / 1.4，size 按此推算
        const shapeSize = style2WidthHeight(shape)
        const size = shapeSize.height
          ? Math.max(12, Math.round(shapeSize.height / 1.4))
          : undefined
        const fill = shape.getAttribute('fillcolor') || ''
        const opacity = Number(
          shape.getElementsByTagName('v:fill')[0]?.getAttribute('opacity') || 1
        )
        return {
          type: 'text',
          data,
          ...(fill && fill !== 'silver' ? { color: normalizeColor(fill) } : {}),
          ...(opacity !== 1 ? { opacity } : {}),
          ...(size ? { size } : {})
        }
      }
      if (imageData && isWatermarkShape) {
        const rId = imageData.getAttribute('r:id') || ''
        const path = rels.internal.get(rId)
        const cached = path ? this.imageCache.get(path) : null
        if (cached) {
          const { width = 0, height = 0 } = style2WidthHeight(shape)
          return {
            type: 'image',
            data: cached.dataUrl,
            ...(width ? { width } : {}),
            ...(height ? { height } : {})
          }
        }
      }
    }
    return undefined
  }

  // 遍历块级容器（body / 页眉页脚根 / 单元格）的直属子节点
  private parseBlockContainer(
    container: Element,
    ctx: ZoneContext
  ): IElement[] {
    const elementList: IElement[] = []
    // 上一段落遗留的行尾换行：列表/表格/分隔线自带断行时省略，避免空行
    let pendingBreak = false
    const flushBreak = (isSelfLineBreak: boolean) => {
      if (pendingBreak && !isSelfLineBreak) {
        elementList.push({ value: '\n', rowMargin: 0 })
      }
      pendingBreak = false
    }
    for (const child of expandWrappers(container)) {
      if (child.tagName === 'w:p') {
        const { elements, trailingBreak } = this.parseParagraph(child, ctx)
        flushBreak(
          elements[0]?.type === ElementType.LIST ||
            elements[0]?.type === ElementType.TABLE ||
            elements[0]?.type === ElementType.SEPARATOR
        )
        elementList.push(...elements)
        pendingBreak = trailingBreak
      } else if (child.tagName === 'w:tbl') {
        flushBreak(true)
        elementList.push(this.parseTable(child, ctx))
      } else if (child.tagName === 'w:sdt') {
        // 内容控件：优先映射为编辑器原生控件（独立成段），
        // 非控件 sdt 递归解析内容
        const controlElement = this.parseSdtControl(child, ctx)
        if (controlElement) {
          flushBreak(false)
          elementList.push(controlElement)
          elementList.push({ value: '\n', rowMargin: 0 })
        } else {
          const sdtContent = elementChildren(child).find(
            el => el.tagName === 'w:sdtContent'
          )
          if (sdtContent) {
            const elements = this.parseBlockContainer(sdtContent, ctx)
            flushBreak(
              elements[0]?.type === ElementType.LIST ||
                elements[0]?.type === ElementType.TABLE
            )
            elementList.push(...elements)
          }
        }
      }
      // sectPr / 书签等其它节点跳过
    }
    if (pendingBreak) {
      elementList.push({ value: '\n', rowMargin: 0 })
    }
    return this.fixupTransitions(elementList)
  }

  // 块级衔接优化（对齐编辑器 setHTML 的数据规范，避免连续换行产生空行）：
  // 1. 标题后补换行——下一元素为列表/表格/分隔线或自带行首换行时不补（INLINE_NODE_NAME 规则）
  // 2. 列表/表格/分隔线自带断行，删除前一元素冗余的行尾换行
  //    （与编辑器 insertElementList"列表前如有换行符则删除-因为列表内已存在"同规则）
  private fixupTransitions(elementList: IElement[]): IElement[] {
    const result: IElement[] = []
    for (let i = 0; i < elementList.length; i++) {
      const element = elementList[i]
      const next = elementList[i + 1]
      const isSelfLineBreakElement =
        element.type === ElementType.LIST ||
        element.type === ElementType.TABLE ||
        element.type === ElementType.SEPARATOR
      // 规则2：前一元素行尾 \n 冗余（独立 \n 空段落除外）
      if (isSelfLineBreakElement) {
        const prev = result[result.length - 1]
        if (
          prev &&
          !prev.valueList?.length &&
          prev.type !== ElementType.TITLE &&
          prev.type !== ElementType.TABLE &&
          prev.type !== ElementType.LIST &&
          prev.value &&
          prev.value !== '\n' &&
          prev.value.endsWith('\n')
        ) {
          prev.value = prev.value.replace(/\n$/, '')
        }
        result.push(element)
        continue
      }
      result.push(element)
      // 规则1：标题后补换行
      if (element.type !== ElementType.TITLE) continue
      if (!next) continue
      const nextIsSelfLineBreak =
        next.type === ElementType.LIST ||
        next.type === ElementType.TABLE ||
        next.type === ElementType.SEPARATOR
      const nextValue = next.valueList?.length
        ? next.valueList[0].value
        : next.value
      if (!nextIsSelfLineBreak && !nextValue?.startsWith('\n')) {
        result.push({ value: '\n', rowMargin: 0 })
      }
    }
    return result
  }

  // 段落 -> 元素列表（标题 / 列表 / 普通文本行）
  // trailingBreak：段落以非文本元素（超链接/图片等）结尾时的行尾换行，
  // 由上层根据下一个块级元素类型决定是否补（列表/表格自带断行时省略）
  private parseParagraph(
    p: Element,
    ctx: ZoneContext
  ): { elements: IElement[]; trailingBreak: boolean } {
    const pPr = p.getElementsByTagName('w:pPr')[0] || null
    const pStyleId =
      pPr?.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ??
      undefined
    // 段落属性继承链：docDefaults -> Normal -> 段落样式 -> 直接格式
    const mergedPpr = mergePpr(
      this.defaultPpr,
      this.defaultParagraphPpr || undefined,
      pStyleId ? this.pprByStyleId.get(pStyleId) : undefined,
      parsePpr(pPr)
    )
    // 标题：样式名映射优先，其次继承链上的大纲级别
    const headingLevel =
      (pStyleId ? this.headingByStyleId.get(pStyleId) : undefined) ??
      (mergedPpr.outlineLvl !== undefined &&
      mergedPpr.outlineLvl >= 0 &&
      mergedPpr.outlineLvl < 6
        ? TITLE_LEVELS[mergedPpr.outlineLvl]
        : undefined)

    const prefix: IElement[] = pPr?.getElementsByTagName('w:pageBreakBefore')
      .length
      ? [{ value: '', type: ElementType.PAGE_BREAK }]
      : []
    // 分节符：仅显式分页类型（nextPage 等）在段落末尾产生分页；
    // 未声明 type 的分节（Word 视作 nextPage，LibreOffice 不分页）跟随 LibreOffice
    const sectionBreakType =
      pPr
        ?.getElementsByTagName('w:sectPr')[0]
        ?.getElementsByTagName('w:type')[0]
        ?.getAttribute('w:val') ?? undefined
    const suffix: IElement[] =
      pPr?.getElementsByTagName('w:sectPr').length &&
      ['nextPage', 'oddPage', 'evenPage', 'nextColumn'].includes(
        sectionBreakType ?? ''
      )
        ? [{ value: '', type: ElementType.PAGE_BREAK }]
        : []

    // 段落底边框的空段落 -> 分隔线（Word"下框线"）
    const separator = this.parseBorderSeparator(p, pPr)
    if (separator) {
      return { elements: [...prefix, separator], trailingBreak: false }
    }

    const inline = this.parseInlineContent(p, ctx, pStyleId)

    // 行属性（行距换算需要段落字号）
    const paragraphSize =
      parseDocxNumber(
        p.getElementsByTagName('w:sz')[0]?.getAttribute('w:val')
      ) || undefined
    const fontSize =
      (paragraphSize ? halfPointToPx(paragraphSize) : undefined) ||
      (pStyleId ? this.styleRPrById.get(pStyleId)?.size : undefined) ||
      this.defaultParagraphStyle?.size ||
      this.defaultRunStyle.size ||
      16
    const props = this.parseParagraphProps(mergedPpr, fontSize)
    // 无显式行距段落的回退：按文档默认段落行距换算（与表格行高地板同一口径）
    const paragraphRowMargin =
      props.rowMargin ?? this.fallbackRowMargin(fontSize)

    // 列表段落：官方壳结构（valueList 扁平流：行首 \n + 内容，项间单换行）
    const numId = mergedPpr.numId
    if (numId) {
      const ilvl = mergedPpr.ilvl || 0
      const levels = this.listTypeByNumId.get(numId)
      const levelInfo = levels?.[ilvl] ?? levels?.[levels.length - 1] ?? null
      if (levelInfo) {
        const { listType: type, listStyle } = levelInfo
        const withRowMargin = (element: IElement): IElement =>
          this.applyParagraphStyle(element, undefined, paragraphRowMargin)
        const valueList: IElement[] = [withRowMargin({ value: '\n' })]
        for (const element of inline) {
          // 项内软换行拆为独立 \n 并标记 listWrap（避免被识别为新列表项）
          if (
            element.type === ElementType.TEXT &&
            element.value?.includes('\n')
          ) {
            const parts = element.value.split('\n')
            for (let p = 0; p < parts.length; p++) {
              if (parts[p]) {
                valueList.push(withRowMargin({ ...element, value: parts[p] }))
              }
              if (p < parts.length - 1) {
                valueList.push(withRowMargin({ value: '\n', listWrap: true }))
              }
            }
          } else {
            valueList.push(withRowMargin(element))
          }
        }
        return {
          elements: [
            ...prefix,
            {
              value: '',
              type: ElementType.LIST,
              listId: numId || '1',
              listType: type,
              ...(listStyle ? { listStyle } : {}),
              listLevel: ilvl,
              valueList
            }
          ],
          trailingBreak: false
        }
      }
    }

    // 目录条目（pStyle 为 toc N 样式）
    const tocLevel = pStyleId
      ? this.tocLevelByStyleId.get(pStyleId)
      : undefined
    if (tocLevel) {
      return {
        elements: [
          ...prefix,
          ...this.parseTocEntry(inline, tocLevel, props.rowFlex),
          ...suffix
        ],
        trailingBreak: false
      }
    }

    // 标题段落：runs 归入 valueList。
    // 编辑器 yn 会把 TITLE 壳拆掉、子元素直接进主列表，行高/字号只认子元素，
    // 且子元素无字号时套用级联默认（32/24/19）——把文档字号与行距显式写入子元素
    if (headingLevel) {
      const valueList = inline
        .filter(element => element.value !== '\n')
        .map(element =>
          this.applyParagraphStyle(
            {
              ...element,
              value: element.value?.replace(/\n$/, '') || '',
              ...(element.size === undefined ? { size: fontSize } : {})
            },
            undefined,
            paragraphRowMargin
          )
        )
      return {
        elements: [
          ...prefix,
          {
            value: '',
            type: ElementType.TITLE,
            level: headingLevel,
            size: fontSize,
            ...(props.rowFlex ? { rowFlex: props.rowFlex } : {}),
            ...(paragraphRowMargin !== undefined
              ? { rowMargin: paragraphRowMargin }
              : {}),
            valueList
          },
          ...suffix
        ],
        trailingBreak: false
      }
    }

    // 普通段落：首行/左缩进用全角空格近似（编辑器无段落缩进属性）
    const indent = this.indentPrefix(mergedPpr, fontSize)
    const hasText = inline.some(
      element =>
        element.type === ElementType.TEXT && (element.value || '').trim() !== ''
    )
    const indentedInline =
      indent && hasText
        ? inline[0].type === ElementType.TEXT
          ? [
              { ...inline[0], value: `${indent}${inline[0].value || ''}` },
              ...inline.slice(1)
            ]
          : [{ value: indent, type: ElementType.TEXT }, ...inline]
        : inline

    // 普通段落：行属性写入行内元素，行尾补 \n
    const lineElements: IElement[] = indentedInline.map(element =>
      this.applyParagraphStyle(element, props.rowFlex, paragraphRowMargin)
    )
    if (!lineElements.length) {
      // \n 为行结束标记，不携带 rowFlex（编辑器断行时 \n 归入下一行，
      // 携带对齐会污染下一行的行首对齐）
      return {
        elements: [
          ...prefix,
          {
            value: '\n',
            type: ElementType.TEXT,
            ...(paragraphRowMargin !== undefined
              ? { rowMargin: paragraphRowMargin }
              : {})
          },
          ...suffix
        ],
        trailingBreak: false
      }
    }
    const last = lineElements[lineElements.length - 1]
    if (last.type === ElementType.TEXT && last.value !== undefined) {
      last.value = last.value.endsWith('\n') ? last.value : `${last.value}\n`
      return {
        elements: [...prefix, ...lineElements, ...suffix],
        trailingBreak: false
      }
    }
    // 分隔线自带行尾换行
    if (last.type === ElementType.SEPARATOR) {
      return {
        elements: [...prefix, ...lineElements, ...suffix],
        trailingBreak: false
      }
    }
    // 非文本结尾：行尾换行延后由上层决定
    return {
      elements: [...prefix, ...lineElements, ...suffix],
      trailingBreak: suffix.length === 0
    }
  }

  // 目录条目规整化：编辑器不支持段落缩进与制表符点线，目录原样导入会
  // 层级混乱、页码位置乱跳——层级用全角空格缩进、统一文档默认字号、
  // 制表符退化为空格分隔
  private parseTocEntry(
    inline: IElement[],
    tocLevel: number,
    rowFlex?: RowFlex
  ): IElement[] {
    const defaultSize =
      this.defaultParagraphStyle?.size || this.defaultRunStyle.size
    const cleaned = inline.flatMap(element => {
      if (element.type === ElementType.TAB) {
        return [{ value: '  ', type: ElementType.TEXT }]
      }
      const { size, ...rest } = element
      void size
      return [{ ...rest, ...(defaultSize ? { size: defaultSize } : {}) }]
    })
    const indent = '\u3000'.repeat((tocLevel - 1) * 2)
    if (indent) {
      if (cleaned.length && cleaned[0].type === ElementType.TEXT) {
        cleaned[0].value = `${indent}${cleaned[0].value || ''}`
      } else {
        cleaned.unshift({ value: indent, type: ElementType.TEXT })
      }
    }
    if (!cleaned.length) {
      return [{ value: '\n', type: ElementType.TEXT, rowMargin: 0 }]
    }
    const lastClean = cleaned[cleaned.length - 1]
    if (lastClean.type === ElementType.TEXT && lastClean.value !== undefined) {
      lastClean.value = lastClean.value.endsWith('\n')
        ? lastClean.value
        : `${lastClean.value}\n`
    } else {
      cleaned.push({ value: '\n', type: ElementType.TEXT, rowMargin: 0 })
    }
    return cleaned.map(element => ({
      ...element,
      ...(rowFlex && !element.rowFlex ? { rowFlex } : {})
    }))
  }

  // 段落底边框（w:pBdr > w:bottom）的空段落 -> 分隔线
  private parseBorderSeparator(
    p: Element,
    pPr: Element | null
  ): IElement | null {
    const pBdr = pPr?.getElementsByTagName('w:pBdr')[0]
    const bottom = pBdr?.getElementsByTagName('w:bottom')[0]
    if (!bottom) return null
    const borderType = bottom.getAttribute('w:val') || ''
    if (['', 'nil', 'none'].includes(borderType)) return null
    // 有文本内容的为带下边框的文字段落，保留为文本
    const text = Array.from(p.getElementsByTagName('w:t'))
      .map(t => t.textContent || '')
      .join('')
      .trim()
    if (text) return null
    return buildSeparator(
      borderType,
      Number(bottom.getAttribute('w:sz') || 0),
      normalizeColor(bottom.getAttribute('w:color'))
    )
  }

  // VML 横线（w:pict 里的 v:line 或扁长 v:rect，Word"插入横线"）-> 分隔线
  private parseVmlSeparator(pict: Element): IElement | null {
    const line = pict.getElementsByTagName('v:line')[0]
    const rect = pict.getElementsByTagName('v:rect')[0]
    if (!line && !rect) return null
    const shape = line || rect
    if (rect) {
      // 矩形需扁长（高度 <= 3pt）才是横线，否则为形状
      const heightPt = Number(
        (rect.getAttribute('style') || '').match(/height:([\d.]+)pt/)?.[1] || 0
      )
      if (heightPt > 3) return null
    }
    const strokeWeightPt = parseDocxNumber(shape?.getAttribute('strokeweight'))
    const dashStyle = shape?.getAttribute('dashstyle') || ''
    return buildSeparator(
      dashStyle && dashStyle !== 'solid' ? 'dashed' : 'single',
      strokeWeightPt ? strokeWeightPt * 8 : 0,
      undefined
    )
  }

  // 段落缩进近似：首行缩进 + 左缩进换算为全角空格（上限 8 字符）
  private indentPrefix(props: PprProps, fontSize: number): string {
    const emPx = Math.max(fontSize, 1)
    let chars = 0
    if (props.firstLineChars !== undefined) {
      chars += props.firstLineChars / 100
    } else if (props.firstLine) {
      chars += props.firstLine / (emPx * TWIP_PER_PX)
    }
    if (props.leftChars !== undefined) {
      chars += props.leftChars / 100
    } else if (props.left) {
      chars += props.left / (emPx * TWIP_PER_PX)
    }
    // 悬挂缩进无法用行首空格表达，按左缩进保留
    const count = Math.min(Math.max(Math.round(chars), 0), 8)
    return count ? '\u3000'.repeat(count) : ''
  }

  // 行距换算（编辑器行高 = 字面高 + 上下各 basicRowMarginHeight × 字号系数 × rowMargin，
  // 字面高按“中”字盒（≈1em）计，与编辑器 measureBasisWord 一致）：
  // auto：Word 行高 = 自然行高（≈1.22em）× line/240，反推 rowMargin；
  // exact/atLeast：固定行高，反推倍数 = (行高px − 字面高px) / (2 × 8 × 字号系数)，
  // 保证与导出侧（行高 px → atLeast twip）往返一致
  private spacingRowMargin(line: number, lineRule: string, fontSize: number): number {
    const size = fontSize || 16
    let ratio = 1
    if (size < 12) {
      ratio = size / 12
    } else if (size > 30) {
      ratio = 1 + (size - 30) / 30
    }
    if (lineRule === 'auto') {
      // 自然行高 ≈ 1.22em（Calibri/Times 等常见字体的 line gap 均值）
      const targetPx = (size * 1.22 * line) / 240
      const glyphPx = size
      return round2(Math.max((targetPx - glyphPx) / (2 * 8 * ratio), 0))
    }
    const lineHeightPx = line / TWIP_PER_PX
    const { ascent, descent } = measureFontMetrics(undefined, size)
    const glyphPx = ascent + descent
    return round2(Math.max((lineHeightPx - glyphPx) / (2 * 8 * ratio), 0.5))
  }

  private parseParagraphProps(
    pPr: PprProps,
    fontSize?: number
  ): {
    rowFlex?: RowFlex
    rowMargin?: number
  } {
    const props: { rowFlex?: RowFlex; rowMargin?: number } = {}
    if (pPr.jc) props.rowFlex = pPr.jc
    const line = pPr.line || 0
    const lineRule = pPr.lineRule || 'auto'
    if (line && line > 0) {
      props.rowMargin = this.spacingRowMargin(line, lineRule, fontSize || 16)
    }
    return props
  }

  // 文档默认段落行距 -> 编辑器行距倍数：无显式行距的段落（列表/标题）按
  // 默认行距渲染，与正文、表格行高地板同一口径
  private fallbackRowMargin(fontSize: number): number | undefined {
    const defaults = mergePpr(
      this.defaultPpr,
      this.defaultParagraphPpr || undefined
    )
    const line = defaults?.line ?? 0
    if (!line || line <= 0) return undefined
    return this.spacingRowMargin(line, defaults?.lineRule ?? 'auto', fontSize)
  }

  // 行内元素套用段落行属性（对齐/行距）；超链接 valueList 子元素也要套
  // （编辑器按子元素计算行高，壳属性不生效）
  private applyParagraphStyle(
    element: IElement,
    rowFlex?: RowFlex,
    rowMargin?: number
  ): IElement {
    const styled: IElement = {
      ...element,
      ...(rowFlex && !element.rowFlex ? { rowFlex } : {}),
      ...(rowMargin !== undefined && element.rowMargin === undefined
        ? { rowMargin }
        : {})
    }
    if (styled.type === ElementType.HYPERLINK && styled.valueList?.length) {
      return {
        ...styled,
        valueList: styled.valueList.map(child =>
          rowMargin !== undefined && child.rowMargin === undefined
            ? { ...child, rowMargin }
            : child
        )
      }
    }
    return styled
  }

  // 段落内的行内内容：runs、超链接、内容控件、域
  private parseInlineContent(
    p: Element,
    ctx: ZoneContext,
    pStyleId?: string
  ): IElement[] {
    const elements: IElement[] = []
    const fields: FieldFrame[] = []
    // 嵌套域的结果汇入外层域
    const emit = (list: IElement[]) => {
      if (!list.length) return
      const top = fields[fields.length - 1]
      if (top) top.result.push(...list)
      else elements.push(...list)
    }
    const finishField = () => {
      const frame = fields.pop()
      if (!frame) return
      if (frame.kind === 'hyperlink' && frame.url && frame.result.length) {
        emit([
          {
            value: '',
            type: ElementType.HYPERLINK,
            url: frame.url,
            valueList: frame.result.filter(element => element.value !== '\n')
          }
        ])
        return
      }
      if (
        (frame.kind === 'page' || frame.kind === 'pageCount') &&
        ctx.zone === 'footer'
      ) {
        // 页脚页码域：交给编辑器 pageNumber 渲染
        emit([
          {
            value: frame.kind === 'page' ? PAGE_NO_TOKEN : PAGE_COUNT_TOKEN,
            type: ElementType.TEXT
          }
        ])
        return
      }
      emit(frame.result)
    }
    for (const child of expandWrappers(p)) {
      const tag = child.tagName
      if (tag === 'w:r') {
        // 仅直属子节点：run 内文本框/图形中的域不属于本 run 的域指令
        const runChildren = elementChildren(child)
        const fldChar = runChildren.find(el => el.tagName === 'w:fldChar')
        if (fldChar) {
          const fldCharType = fldChar.getAttribute('w:fldCharType') || ''
          if (fldCharType === 'begin') {
            const ffData = fldChar.getElementsByTagName('w:ffData')[0]
            if (ffData) {
              const controlElement = this.parseFfDataControl(ffData)
              if (controlElement) {
                emit([controlElement])
                // 窗体域显示值不重复输出，直到 end
                fields.push({
                  phase: 'result',
                  instruction: '',
                  result: [],
                  kind: 'form'
                })
                continue
              }
            }
            fields.push(createFieldFrame())
            continue
          }
          if (fldCharType === 'separate') {
            const top = fields[fields.length - 1]
            if (top && top.phase === 'instruction') {
              top.phase = 'result'
              resolveField(top)
            }
            continue
          }
          if (fldCharType === 'end') finishField()
          continue
        }
        const instrText = runChildren.find(el => el.tagName === 'w:instrText')
        if (instrText) {
          const top = fields[fields.length - 1]
          if (top && top.phase === 'instruction') {
            top.instruction += instrText.textContent || ''
          }
          continue
        }
        const top = fields[fields.length - 1]
        // 指令阶段（含未 separate 的锁定域）/窗体域显示值不输出
        if (top && (top.phase === 'instruction' || top.kind === 'form')) continue
        emit(this.parseRun(child, ctx, pStyleId))
      } else if (tag === 'w:sdt') {
        // 内容控件：优先映射为编辑器原生控件，非控件 sdt 提取内容文本
        const controlElement = this.parseSdtControl(child, ctx)
        if (controlElement) {
          emit([controlElement])
        } else {
          const sdtContent = elementChildren(child).find(
            el => el.tagName === 'w:sdtContent'
          )
          if (sdtContent) {
            emit(this.parseSdtInlineRuns(sdtContent, ctx))
          }
        }
      } else if (tag === 'w:fldSimple') {
        const frame = createFieldFrame()
        frame.instruction = child.getAttribute('w:instr') || ''
        frame.phase = 'result'
        resolveField(frame)
        frame.result = expandWrappers(child).flatMap(inner =>
          inner.tagName === 'w:r' ? this.parseRun(inner, ctx, pStyleId) : []
        )
        if (frame.kind === 'hyperlink' && frame.url && frame.result.length) {
          emit([
            {
              value: '',
              type: ElementType.HYPERLINK,
              url: frame.url,
              valueList: frame.result.filter(element => element.value !== '\n')
            }
          ])
        } else if (
          (frame.kind === 'page' || frame.kind === 'pageCount') &&
          ctx.zone === 'footer'
        ) {
          emit([
            {
              value: frame.kind === 'page' ? PAGE_NO_TOKEN : PAGE_COUNT_TOKEN,
              type: ElementType.TEXT
            }
          ])
        } else {
          emit(frame.result)
        }
      } else if (tag === 'w:hyperlink') {
        const runs = expandWrappers(child)
          .flatMap(inner =>
            inner.tagName === 'w:r' ? this.parseRun(inner, ctx, pStyleId) : []
          )
          .filter(element => element.value !== '\n')
        const url = ctx.rels.external.get(child.getAttribute('r:id') || '')
        if (url && runs.length) {
          emit([
            {
              value: '',
              type: ElementType.HYPERLINK,
              url,
              valueList: runs
            }
          ])
        } else {
          // 内部锚点无 url，降级为普通文本
          emit(runs)
        }
      }
      // 书签/校对标记等跳过
    }
    // 未闭合的域（文档异常）：按已收集结果输出
    while (fields.length) finishField()
    return elements
  }

  private parseRun(
    run: Element,
    ctx: ZoneContext,
    pStyleId?: string
  ): IElement[] {
    const explicitRPr = run.getElementsByTagName('w:rPr')[0] || null
    const rStyleId = explicitRPr
      ?.getElementsByTagName('w:rStyle')[0]
      ?.getAttribute('w:val')
    // 样式优先级：docDefaults -> Normal 默认段落样式 -> 段落样式 -> 字符样式 -> 显式 rPr
    const style = mergeStyle(
      this.defaultRunStyle,
      this.defaultParagraphStyle || {},
      pStyleId ? this.styleRPrById.get(pStyleId) || {} : {},
      rStyleId ? this.styleRPrById.get(rStyleId) || {} : {},
      parseRPr(explicitRPr, this.theme)
    )
    // 隐藏文字（w:vanish）按 Word 视图语义不导入
    if (style.hidden) return []
    const elementStyle = toElementStyle(style)
    const textType =
      style.verticalType === 'superscript'
        ? ElementType.SUPERSCRIPT
        : style.verticalType === 'subscript'
          ? ElementType.SUBSCRIPT
          : ElementType.TEXT
    const makeText = (text: string): IElement[] => {
      if (!text) return []
      return [
        {
          value: style.caps ? text.toUpperCase() : text,
          type: textType,
          ...elementStyle
        }
      ]
    }
    const elements: IElement[] = []
    for (const child of expandWrappers(run)) {
      const tag = child.tagName
      if (tag === 'w:t') {
        elements.push(...makeText(child.textContent || ''))
      } else if (tag === 'w:br') {
        if (child.getAttribute('w:type') === 'page') {
          elements.push({ value: '', type: ElementType.PAGE_BREAK })
        } else {
          appendLineBreak(elements, style)
        }
      } else if (tag === 'w:cr') {
        appendLineBreak(elements, style)
      } else if (tag === 'w:tab') {
        elements.push({ value: '', type: ElementType.TAB })
      } else if (tag === 'w:noBreakHyphen') {
        elements.push(...makeText('\u2011'))
      } else if (tag === 'w:sym') {
        const code = parseInt(child.getAttribute('w:char') || '', 16)
        if (code) elements.push(...makeText(String.fromCharCode(code)))
      } else if (
        tag === 'w:footnoteReference' ||
        tag === 'w:endnoteReference'
      ) {
        const kind = tag === 'w:footnoteReference' ? 'footnote' : 'endnote'
        const marker = this.noteReferenceElement(
          kind,
          child.getAttribute('w:id') || ''
        )
        if (marker) elements.push(marker)
      } else if (tag === 'w:drawing' || tag === 'w:pict' || tag === 'w:object') {
        const image = this.parseDrawing(child, ctx)
        if (image) {
          elements.push(image)
        } else {
          const separator = this.parseVmlSeparator(child)
          if (separator) elements.push(separator)
        }
        // 文本框内容（编辑器无原生文本框，按行内内容保留）
        elements.push(...this.parseTextboxes(child, ctx))
      } else if (tag === 'w:sdt' || tag === 'w:fldSimple') {
        // run 内内容控件 / 域：提取内容 runs
        const sdtContent = elementChildren(child).find(
          el => el.tagName === 'w:sdtContent'
        )
        const contentChildren = sdtContent
          ? expandWrappers(sdtContent)
          : expandWrappers(child)
        for (const inner of contentChildren) {
          if (inner.tagName === 'w:r') {
            elements.push(...this.parseRun(inner, ctx, pStyleId))
          }
        }
      }
    }
    return elements
  }

  // 文本框（DrawingML wps:txbx / VML v:textbox）内的块级内容 -> 行内元素
  private parseTextboxes(container: Element, ctx: ZoneContext): IElement[] {
    const elements: IElement[] = []
    for (const textbox of Array.from(
      container.getElementsByTagName('w:txbxContent')
    )) {
      // 跳过嵌套文本框（外层已包含），避免重复
      let parent = textbox.parentElement
      let nested = false
      while (parent && parent !== container) {
        if (parent.tagName === 'w:txbxContent') {
          nested = true
          break
        }
        parent = parent.parentElement
      }
      if (nested) continue
      elements.push(...this.parseBlockContainer(textbox, ctx))
    }
    return elements
  }

  // 内容控件（w:sdt）映射为编辑器原生控件：
  // w14:checkbox -> 复选框元素；dropDownList/comboBox -> 下拉控件；
  // date -> 日期控件；其余（含 w:text）-> 文本控件（浅蓝底纹样式由编辑器渲染）
  private parseSdtControl(sdt: Element, ctx: ZoneContext): IElement | null {
    const sdtPr = elementChildren(sdt).find(el => el.tagName === 'w:sdtPr')
    const sdtContent = elementChildren(sdt).find(
      el => el.tagName === 'w:sdtContent'
    )
    if (!sdtPr && !sdtContent) return null
    // 内容文本（当前值）
    const contentText = sdtContent
      ? Array.from(sdtContent.getElementsByTagName('w:t'))
          .map(t => t.textContent || '')
          .join('')
      : ''
    // 复选框内容控件
    const checkbox = sdtPr?.getElementsByTagName('w14:checkbox')[0]
    if (checkbox) {
      const checked = ['1', 'true'].includes(
        checkbox
          .getElementsByTagName('w14:checked')[0]
          ?.getAttribute('w14:val') || ''
      )
      return {
        value: '',
        type: ElementType.CHECKBOX,
        checkbox: { value: checked }
      }
    }
    // 下拉 / 组合框
    const dropDown =
      sdtPr?.getElementsByTagName('w:dropDownList')[0] ||
      sdtPr?.getElementsByTagName('w:comboBox')[0]
    if (dropDown) {
      const valueSets = Array.from(
        dropDown.getElementsByTagName('w:listItem')
      ).map(item => {
        const code = item.getAttribute('w:value') || ''
        return {
          value: item.getAttribute('w:displayText') || code,
          code
        }
      })
      const code =
        valueSets.find(set => set.value === contentText)?.code ||
        valueSets[0]?.code ||
        ''
      return this.buildControlShell({
        type: ControlType.SELECT,
        code,
        valueSets,
        value: [{ value: contentText }]
      })
    }
    // 日期选择器
    const date = sdtPr?.getElementsByTagName('w:date')[0]
    if (date) {
      const dateFormat =
        date.getAttribute('w:dateFormat')?.replace(/'/g, '') || undefined
      return this.buildControlShell({
        type: ControlType.DATE,
        ...(dateFormat ? { dateFormat } : {}),
        value: contentText ? [{ value: contentText }] : []
      })
    }
    // 富文本 / 纯文本控件：需有明确控件标记（w:text / w:richText）。
    // 内容型 sdt（文档部件 docPartObj、分组 group、图片 picture 等）
    // 不生成控件，交由上层按普通内容递归解析——否则页眉模板的
    // 外层 sdt 会把整个页眉内容包成一个控件
    if (
      !sdtPr?.getElementsByTagName('w:text').length &&
      !sdtPr?.getElementsByTagName('w:richText').length &&
      !sdtPr?.getElementsByTagName('w:number').length
    ) {
      return null
    }
    const contentElements = sdtContent
      ? this.parseSdtInlineRuns(sdtContent, ctx)
      : []
    return this.buildControlShell({
      type: ControlType.TEXT,
      value: contentElements.length
        ? contentElements
        : contentText
          ? [{ value: contentText, type: ElementType.TEXT }]
          : []
    })
  }

  // 旧式窗体域（w:ffData）：复选框 / 下拉 / 文本窗体 -> 编辑器控件
  private parseFfDataControl(ffData: Element): IElement | null {
    const checkBox = ffData.getElementsByTagName('w:checkBox')[0]
    if (checkBox) {
      const checkedElement = checkBox.getElementsByTagName('w:checked')[0]
      const checked =
        !!checkedElement &&
        !['0', 'false', 'off'].includes(
          checkedElement.getAttribute('w:val') || ''
        )
      return {
        value: '',
        type: ElementType.CHECKBOX,
        checkbox: { value: checked }
      }
    }
    const ddList = ffData.getElementsByTagName('w:ddList')[0]
    if (ddList) {
      const valueSets = Array.from(
        ddList.getElementsByTagName('w:listEntry')
      ).map(entry => ({
        value: entry.getAttribute('w:val') || '',
        code: entry.getAttribute('w:val') || ''
      }))
      const result = Number(
        ddList.getElementsByTagName('w:result')[0]?.getAttribute('w:val') || 0
      )
      const selected = valueSets[result] || valueSets[0]
      return this.buildControlShell({
        type: ControlType.SELECT,
        code: selected?.code || '',
        valueSets,
        value: selected ? [{ value: selected.value }] : []
      })
    }
    // 文本窗体：默认值
    const defaultText =
      ffData.getElementsByTagName('w:t')[0]?.getAttribute('w:val') || ''
    return this.buildControlShell({
      type: ControlType.TEXT,
      value: defaultText ? [{ value: defaultText }] : []
    })
  }

  private buildControlShell(control: object): IElement {
    return {
      value: '',
      type: ElementType.CONTROL,
      control: { id: generateControlId(), ...control }
    } as unknown as IElement
  }

  // 提取 sdtContent 的行内 runs（保留样式）
  private parseSdtInlineRuns(
    sdtContent: Element,
    ctx: ZoneContext
  ): IElement[] {
    const elements: IElement[] = []
    for (const child of elementChildren(sdtContent)) {
      if (child.tagName === 'w:p') {
        elements.push(...this.parseInlineContent(child, ctx))
      } else if (child.tagName === 'w:r') {
        elements.push(...this.parseRun(child, ctx))
      }
    }
    return elements.filter(el => el.value !== '\n')
  }

  // 图片：wp:inline 内联 / wp:anchor 浮动（含衬于文字下方、环绕）
  private parseDrawing(drawing: Element, ctx: ZoneContext): IElement | null {
    const blip = drawing.getElementsByTagName('a:blip')[0]
    const imgData = drawing.getElementsByTagName('v:imagedata')[0]
    // 水印 shape 不作为内容图片导入（由 parseWatermark 处理）
    const isWatermarkPict =
      imgData &&
      !blip &&
      (drawing.getElementsByTagName('v:textpath').length > 0 ||
        /watermark/i.test(
          drawing.getElementsByTagName('v:shape')[0]?.getAttribute('id') || ''
        ))
    if (isWatermarkPict) return null
    const rId =
      blip?.getAttribute('r:embed') || imgData?.getAttribute('r:id') || ''
    if (!rId) return null
    const path = ctx.rels.internal.get(rId)
    const cached = path ? this.imageCache.get(path) : null
    if (!path || !cached) return null
    // 尺寸：优先 wp:extent，其次 VML style（pt），最后按字节嗅探的原始尺寸
    const extent = drawing.getElementsByTagName('wp:extent')[0]
    let width = emuToPx(Number(extent?.getAttribute('cx') || 0))
    let height = emuToPx(Number(extent?.getAttribute('cy') || 0))
    if (!width || !height) {
      const shapeSize = style2WidthHeight(
        drawing.getElementsByTagName('v:shape')[0]
      )
      width = shapeSize.width || 0
      height = shapeSize.height || 0
    }
    if ((!width || !height) && cached.size) {
      width = cached.size.width
      height = cached.size.height
    }
    const image: IElement = {
      value: cached.dataUrl,
      type: ElementType.IMAGE,
      width: width || 100,
      height: height || 100
    }
    // 浮动定位：behindDoc（衬于文字下方）作背景图处理，保留锚点偏移。
    // 其余 wp:anchor 中四周/紧密/穿越环绕型（wrapSquare/wrapTight/wrapThrough）
    // 转为 surround 环绕图片：posOffset 是相对段落/栏的偏移，导入期无法换算成
    // 页面绝对坐标，不预设 imgFloatPosition，由 canvas-editor 布局时按锚点行
    // 左上角自动定位，文本环绕图片排版。wrapTopAndBottom 无环绕语义，保持内联
    const anchor = drawing.getElementsByTagName('wp:anchor')[0]
    if (anchor?.getAttribute('behindDoc') === '1') {
      const x = emuToPx(
        Number(
          anchor
            .getElementsByTagName('wp:positionH')[0]
            ?.getElementsByTagName('wp:posOffset')[0]?.textContent || 0
        )
      )
      const y = emuToPx(
        Number(
          anchor
            .getElementsByTagName('wp:positionV')[0]
            ?.getElementsByTagName('wp:posOffset')[0]?.textContent || 0
        )
      )
      image.imgDisplay = ImageDisplay.FLOAT_BOTTOM
      image.imgFloatPosition = { x, y }
    } else if (
      anchor &&
      (anchor.getElementsByTagName('wp:wrapSquare').length ||
        anchor.getElementsByTagName('wp:wrapTight').length ||
        anchor.getElementsByTagName('wp:wrapThrough').length)
    ) {
      image.imgDisplay = ImageDisplay.SURROUND
    }
    return image
  }

  // 表格：tblGrid 列宽、行高、合并（gridSpan/vMerge）、边框、底纹、垂直对齐
  private parseTable(tbl: Element, ctx: ZoneContext): IElement {
    // 列宽：仅取直属 tblGrid
    const colgroup: { width: number }[] = []
    const tblGrid = elementChildren(tbl).find(
      child => child.tagName === 'w:tblGrid'
    )
    if (tblGrid) {
      for (const gridCol of elementChildren(tblGrid)) {
        if (gridCol.tagName === 'w:gridCol') {
          colgroup.push({
            width: twipToPx(parseDocxNumber(gridCol.getAttribute('w:w')))
          })
        }
      }
    }
    // 行/格（直属），展开逻辑属性；单元格可被内容控件（w:sdt）包裹
    const rows = elementChildren(tbl).filter(child => child.tagName === 'w:tr')
    const rowCells = (tr: Element): Element[] => {
      const cells: Element[] = []
      for (const child of expandWrappers(tr)) {
        if (child.tagName === 'w:tc') {
          cells.push(child)
        } else if (child.tagName === 'w:sdt') {
          const content = elementChildren(child).find(
            el => el.tagName === 'w:sdtContent'
          )
          if (content) {
            cells.push(
              ...elementChildren(content).filter(el => el.tagName === 'w:tc')
            )
          }
        }
      }
      return cells
    }
    interface LogicalCell {
      tc: Element
      colspan: number
      vMerge: 'restart' | 'continue' | null
    }
    const logicalRows: LogicalCell[][] = rows.map(tr =>
      rowCells(tr)
        .map(tc => {
          const tcPr = elementChildren(tc).find(el => el.tagName === 'w:tcPr')
          const colspan =
            parseDocxNumber(
              tcPr?.getElementsByTagName('w:gridSpan')[0]?.getAttribute('w:val')
            ) || 1
          const vMergeElement = tcPr?.getElementsByTagName('w:vMerge')[0]
          const vMerge = vMergeElement
            ? vMergeElement.getAttribute('w:val') === 'restart'
              ? 'restart'
              : 'continue'
            : null
          return { tc, colspan, vMerge }
        })
    )
    // 每行各格的起始网格列
    const gridStartCache = new Map<string, number>()
    const gridStartOf = (rowIndex: number, cellIndex: number): number => {
      const key = `${rowIndex}:${cellIndex}`
      const cached = gridStartCache.get(key)
      if (cached !== undefined) return cached
      let col = 0
      for (let c = 0; c < cellIndex; c++) {
        col += logicalRows[rowIndex][c].colspan
      }
      gridStartCache.set(key, col)
      return col
    }
    // restart 的 rowspan = 下方相同列位连续 continue 的行数 + 1
    const rowspanOf = (
      rowIndex: number,
      cellIndex: number,
      colspan: number
    ): number => {
      const startGrid = gridStartOf(rowIndex, cellIndex)
      let span = 1
      for (let r2 = rowIndex + 1; r2 < logicalRows.length; r2++) {
        let col = 0
        let matched: LogicalCell | null = null
        for (let c2 = 0; c2 < logicalRows[r2].length; c2++) {
          if (col === startGrid) {
            matched = logicalRows[r2][c2]
            break
          }
          col += logicalRows[r2][c2].colspan
        }
        if (matched?.vMerge === 'continue' && matched.colspan === colspan) {
          span++
        } else {
          break
        }
      }
      return span
    }
    // 表格边框：表格样式 tblBorders <- 直接 tblBorders <- 单元格 tcBorders
    const tblPr = elementChildren(tbl).find(child => child.tagName === 'w:tblPr')
    const styleId = tblPr
      ?.getElementsByTagName('w:tblStyle')[0]
      ?.getAttribute('w:val')
    const styleBorders = styleId
      ? this.tableBordersByStyleId.get(styleId)
      : undefined
    const directBorders = parseTableBorders(
      tblPr?.getElementsByTagName('w:tblBorders')[0]
    )
    const tableBorders: TableBorders = {
      ...styleBorders,
      ...directBorders
    }
    const hasTableBorders = Object.keys(tableBorders).length > 0
    const hasCellBorders = logicalRows.some(row =>
      row.some(cell =>
        elementChildren(cell.tc)
          .find(el => el.tagName === 'w:tcPr')
          ?.getElementsByTagName('w:tcBorders')[0]
      )
    )
    const gridCols =
      colgroup.length ||
      logicalRows.reduce(
        (max, row) => Math.max(max, row.reduce((sum, cell) => sum + cell.colspan, 0)),
        0
      )
    const outerOn = ['top', 'left', 'bottom', 'right'].every(
      side => tableBorders[side as TableBorderSide] === true
    )
    const outerOff = ['top', 'left', 'bottom', 'right'].every(
      side => !tableBorders[side as TableBorderSide]
    )
    const innerOn = ['insideH', 'insideV'].every(
      side => tableBorders[side as TableBorderSide] === true
    )
    const innerOff = ['insideH', 'insideV'].every(
      side => !tableBorders[side as TableBorderSide]
    )
    let tableBorderType: TableBorder | undefined
    if (hasTableBorders) {
      if (outerOn && innerOn) tableBorderType = TableBorder.ALL
      else if (outerOn && innerOff) tableBorderType = TableBorder.EXTERNAL
      else if (outerOff && innerOff) tableBorderType = TableBorder.EMPTY
    }
    // 混合边框/单元格覆盖：表格级边框类型无法表达，退回逐格边框
    const perCellBorders =
      hasCellBorders || (hasTableBorders && tableBorderType === undefined)
    if (perCellBorders) tableBorderType = TableBorder.EMPTY
    const verticalAlignMap: Record<string, VerticalAlign> = {
      top: VerticalAlign.TOP,
      center: VerticalAlign.MIDDLE,
      bottom: VerticalAlign.BOTTOM
    }
    const trList: IElement['trList'] = []
    for (let r = 0; r < logicalRows.length; r++) {
      const tdList: NonNullable<IElement['trList']>[number]['tdList'] = []
      for (let c = 0; c < logicalRows[r].length; c++) {
        const cell = logicalRows[r][c]
        if (cell.vMerge === 'continue') continue
        const rowspan =
          cell.vMerge === 'restart' ? rowspanOf(r, c, cell.colspan) : 1
        const tcPr =
          elementChildren(cell.tc).find(el => el.tagName === 'w:tcPr') || null
        const tcWElement = tcPr?.getElementsByTagName('w:tcW')[0]
        const tcW = parseDocxNumber(tcWElement?.getAttribute('w:w'))
        const tcWType = tcWElement?.getAttribute('w:type') || 'dxa'
        const tableWidth = colgroup.reduce((sum, col) => sum + col.width, 0)
        const vAlign = tcPr
          ?.getElementsByTagName('w:vAlign')[0]
          ?.getAttribute('w:val')
        const backgroundColor = normalizeColor(
          tcPr?.getElementsByTagName('w:shd')[0]?.getAttribute('w:fill') ?? null
        )
        // 单元格边框：表格边（外边框/内框线）+ tcBorders 覆盖
        const tcBorders = parseTableBorders(
          tcPr?.getElementsByTagName('w:tcBorders')[0]
        )
        const borderTypes: TdBorder[] = []
        if (perCellBorders) {
          const gridStart = gridStartOf(r, c)
          const gridEnd = gridStart + cell.colspan - 1
          const edges: [TdBorder, boolean | undefined][] = [
            [
              TdBorder.TOP,
              tcBorders?.top ??
                (r === 0 ? tableBorders.top : tableBorders.insideH)
            ],
            [
              TdBorder.BOTTOM,
              tcBorders?.bottom ??
                (r + rowspan >= logicalRows.length
                  ? tableBorders.bottom
                  : tableBorders.insideH)
            ],
            [
              TdBorder.LEFT,
              tcBorders?.left ??
                (gridStart === 0 ? tableBorders.left : tableBorders.insideV)
            ],
            [
              TdBorder.RIGHT,
              tcBorders?.right ??
                (gridEnd >= gridCols - 1
                  ? tableBorders.right
                  : tableBorders.insideV)
            ]
          ]
          for (const [side, enabled] of edges) {
            if (enabled) borderTypes.push(side)
          }
        }
        const width =
          tcWType === 'pct' && tableWidth
            ? Math.round((tableWidth * tcW) / 5000)
            : tcW
              ? twipToPx(tcW)
              : undefined
        tdList.push({
          colspan: cell.colspan,
          rowspan,
          value: trimTrailingBreaks(this.parseBlockContainer(cell.tc, ctx)),
          ...(width ? { width } : {}),
          ...(vAlign && verticalAlignMap[vAlign]
            ? { verticalAlign: verticalAlignMap[vAlign] }
            : {}),
          ...(backgroundColor ? { backgroundColor } : {}),
          ...(perCellBorders ? { borderTypes } : {})
        })
      }
      const trPr = elementChildren(rows[r]).find(el => el.tagName === 'w:trPr')
      const trHeight = parseDocxNumber(
        trPr?.getElementsByTagName('w:trHeight')[0]?.getAttribute('w:val')
      )
      trList.push({
        // 未声明行高时给一个等于编辑器行高地板的值：paging 布局会按内容撑高
        height: trHeight ? twipToPx(trHeight) : DEFAULT_TABLE_ROW_MIN_HEIGHT,
        tdList,
        ...(trPr?.getElementsByTagName('w:tblHeader').length
          ? { pagingRepeat: true }
          : {})
      })
    }
    // 表格行高地板 = tdPadding + 默认字号 + 2 × 8 × rowMargin（table 元素默认
    // rowMargin=1 → 36px 地板，远高于 Word 行高）；按文档默认行距换算行高倍数，
    // 使行高地板接近 Word/LibreOffice 实际行高（11pt 文本 1.15 倍行距 ≈ 26px）
    const defaultPpr = mergePpr(
      this.defaultPpr,
      this.defaultParagraphPpr || undefined
    )
    const defaultLine = defaultPpr?.line ?? 0
    const tableRowMargin =
      defaultLine && defaultLine > 0
        ? this.spacingRowMargin(
            defaultLine,
            defaultPpr?.lineRule ?? 'auto',
            this.defaultParagraphStyle?.size ??
              this.defaultRunStyle.size ??
              16
          )
        : undefined
    return {
      value: '\n',
      type: ElementType.TABLE,
      ...(tableRowMargin !== undefined ? { rowMargin: tableRowMargin } : {}),
      ...(colgroup.length ? { colgroup } : {}),
      ...(tableBorderType ? { borderType: tableBorderType } : {}),
      trList
    }
  }
}


// ====================================================================
// 导入入口
// =====================================================================

export function createDocxImporter(command: Command) {
  return async function (options: IImportDocxOption) {
    const { arrayBuffer, isAppend } = options
    const zip = await JSZip.loadAsync(arrayBuffer)
    const parser = new DocxParser(zip)
    const {
      watermark,
      pageSetup,
      disabledPages,
      pageNumber,
      zoneOffsets,
      ...data
    } = await parser.parse()
    // 追加模式：仅插入正文到文档末尾，不覆盖已有内容
    if (isAppend) {
      const commandAny = command as unknown as {
        executeInsertElementList?: (payload: IElement[]) => void
      }
      commandAny.executeInsertElementList?.(data.main || [])
      return
    }
    // 纸张/边距/方向/默认字体/水印 -> 编辑器配置
    // 注意：updateOptions 会将未传字段重置为默认值，需带上当前配置
    // 导入为整体替换语义：docx 无水印时显式清除编辑器已有水印
    const currentOptions = (command.getValue().options || {}) as Record<
      string,
      any
    >
    const hasCurrentWatermark = !!currentOptions.watermark?.data
    if (
      watermark ||
      pageSetup ||
      disabledPages ||
      pageNumber ||
      zoneOffsets ||
      hasCurrentWatermark
    ) {
      const commandAny = command as unknown as {
        executeUpdateOptions?: (payload: object) => void
        getValue: () => { options: object }
      }
      if (commandAny.executeUpdateOptions) {
        const update: Record<string, any> = {
          ...currentOptions,
          watermark: watermark || { data: '' },
          ...pageSetup
        }
        // 页脚页码域：docx 无页码时禁用编辑器已有页码
        update.pageNumber = pageNumber
          ? { ...currentOptions.pageNumber, ...pageNumber, disabled: false }
          : { ...currentOptions.pageNumber, disabled: true }
        // 页眉/页脚距边距离（sectPr header/footer 引用）
        if (zoneOffsets?.headerTop !== undefined || disabledPages?.header) {
          update.header = {
            ...currentOptions.header,
            ...(zoneOffsets?.headerTop !== undefined
              ? { top: zoneOffsets.headerTop }
              : {}),
            ...(disabledPages?.header
              ? { disabledPages: disabledPages.header }
              : {})
          }
        }
        if (zoneOffsets?.footerBottom !== undefined || disabledPages?.footer) {
          update.footer = {
            ...currentOptions.footer,
            ...(zoneOffsets?.footerBottom !== undefined
              ? { bottom: zoneOffsets.footerBottom }
              : {}),
            ...(disabledPages?.footer
              ? { disabledPages: disabledPages.footer }
              : {})
          }
        }
        commandAny.executeUpdateOptions(update)
      }
    }
    command.executeSetValue(data)
  }
}

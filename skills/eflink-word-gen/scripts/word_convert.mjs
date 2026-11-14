#!/usr/bin/env node
/**
 * WordSpec → .efw.json（canvas-editor 原生数据，eflink-word 编辑器「导入文件」直接打开）
 *          + .content.json（{main,header,footer}，模板入库 content 原样使用）
 *          + .html（A4 版式预览，供自检）
 * 用法：node word_convert.mjs my-spec.json -o ./out
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const inFile = args.find((a) => !a.startsWith('-'));
const outFlag = args.indexOf('-o');
const outDir = outFlag >= 0 ? args[outFlag + 1] : '.';
if (!inFile) {
  console.error('用法: node word_convert.mjs my-spec.json -o ./out');
  process.exit(1);
}

const warnings = [];
const warn = (m) => warnings.push(m);

const spec = JSON.parse(fs.readFileSync(inFile, 'utf8'));
if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('spec 必须是对象');
const blocks = spec.content ?? spec.main;
if (!Array.isArray(blocks) || !blocks.length) throw new Error('spec.content 必须是非空数组');

const PAGE = { width: 794, height: 1123 };
const MARGIN = [100, 120, 100, 120];
const DEFAULT_FONT = 'Microsoft YaHei';
const DEFAULT_SIZE = 16;
const TITLE_SIZE = { first: 32, second: 24, third: 19, fourth: 17, fifth: 15, sixth: 14 };
const LIST_STYLES = ['disc', 'circle', 'square', 'decimal', 'checkbox'];
const BORDER_TYPES = ['all', 'empty', 'external', 'internal', 'dash'];

const pageSpec = spec.page ?? {};
const page = {
  width: pageSpec.width ?? PAGE.width,
  height: pageSpec.height ?? PAGE.height,
  margin: Array.isArray(pageSpec.margin) && pageSpec.margin.length === 4 ? pageSpec.margin : MARGIN,
  font: pageSpec.defaultFont ?? DEFAULT_FONT,
  size: pageSpec.defaultSize ?? DEFAULT_SIZE,
};
if (pageSpec.paperSize === 'A4' && pageSpec.direction === 'horizontal') {
  [page.width, page.height] = [page.height, page.width];
} else if (pageSpec.direction === 'horizontal') {
  [page.width, page.height] = [page.height, page.width];
}

const hex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);

function styleFromRun(run) {
  const s = {};
  if (run.bold) s.bold = true;
  if (run.italic) s.italic = true;
  if (run.underline) s.underline = true;
  if (run.strikeout) s.strikeout = true;
  if (hex(run.color)) s.color = run.color;
  else if (run.color !== undefined) warn(`run.color 非法(${run.color})，已忽略`);
  if (hex(run.highlight)) s.highlight = run.highlight;
  else if (run.highlight !== undefined) warn(`run.highlight 非法(${run.highlight})，已忽略`);
  if (num(run.size) && run.size >= 8 && run.size <= 96) s.size = run.size;
  else if (run.size !== undefined) warn(`run.size 超出 8~96，已忽略`);
  if (typeof run.font === 'string' && run.font) s.font = run.font;
  if (num(run.letterSpacing)) s.letterSpacing = run.letterSpacing;
  if (run.script === 'super') s.type = 'superscript';
  else if (run.script === 'sub') s.type = 'subscript';
  return s;
}

function normalizeRuns(block, where) {
  if (Array.isArray(block.runs) && block.runs.length) {
    return block.runs
      .filter((r) => r && typeof r.text === 'string')
      .map((r) => ({ text: r.text, style: styleFromRun(r) }));
  }
  if (typeof block.text === 'string') return [{ text: block.text, style: styleFromRun(block) }];
  warn(`${where} 缺少 text/runs，已跳过`);
  return null;
}

function alignOf(block, where) {
  if (block.align === undefined) return undefined;
  if (['left', 'center', 'right', 'justify'].includes(block.align)) return block.align;
  warn(`${where}.align="${block.align}" 非法，已忽略`);
  return undefined;
}

function textElements(runs, { align, size, rowMargin, newline = true, extra = {} } = {}) {
  const els = runs.map((r) => ({ type: 'text', value: r.text, ...r.style, ...extra }));
  if (!els.length) els.push({ type: 'text', value: '', ...extra });
  const last = els[els.length - 1];
  if (newline && typeof last.value === 'string') last.value += '\n';
  for (const el of els) {
    if (align) el.rowFlex = align;
    if (num(size)) el.size = size;
    if (num(rowMargin)) el.rowMargin = rowMargin;
  }
  return els;
}

let elementSeq = 0;
const nextId = (p) => `${p}-${++elementSeq}`;

function emitHeading(block, where) {
  const runs = normalizeRuns(block, where);
  if (!runs) return [];
  const level = block.level ?? 1;
  let levelName;
  if (typeof level === 'number' && level >= 1 && level <= 6) {
    levelName = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][level - 1];
  } else if (typeof level === 'string' && TITLE_SIZE[level]) {
    levelName = level;
  } else {
    warn(`${where}.level="${level}" 非法（1~6），按 1 处理`);
    levelName = 'first';
  }
  const align = alignOf(block, where);
  const size = num(block.size) ? block.size : TITLE_SIZE[levelName];
  const valueList = textElements(runs, { align, size, rowMargin: block.rowMargin });
  const value = valueList.map((e) => e.value).join('');
  return [{ type: 'title', value, level: levelName, size, ...(align ? { rowFlex: align } : {}), ...(num(block.rowMargin) ? { rowMargin: block.rowMargin } : {}), valueList }];
}

const INDENT_UNIT = '　';
function emitParagraph(block, where) {
  const runs = normalizeRuns(block, where);
  if (!runs) return [];
  const align = alignOf(block, where);
  let indent = block.indent ?? 0;
  if (!Number.isInteger(indent) || indent < 0 || indent > 12) {
    if (block.indent !== undefined) warn(`${where}.indent 必须是 0~12 整数，已忽略`);
    indent = 0;
  }
  if (runs.length && indent) runs[0] = { ...runs[0], text: INDENT_UNIT.repeat(indent) + runs[0].text };
  else if (indent) runs.push({ text: INDENT_UNIT.repeat(indent), style: {} });
  const els = textElements(runs, { align, size: block.size, rowMargin: block.rowMargin });
  if (block.hyperlink) {
    const url = block.hyperlink;
    if (!/^https?:\/\//.test(url)) warn(`${where}.hyperlink 非 http(s)，已忽略`);
    else {
      const inner = els.filter((e) => e !== els[els.length - 1]).map((e) => ({ ...e, value: e.value }));
      const last = els[els.length - 1];
      const lastText = typeof last.value === 'string' ? last.value.replace(/\n$/, '') : '';
      if (lastText) inner.push({ ...last, value: lastText });
      return [
        { type: 'hyperlink', value: '', url, valueList: inner },
        { type: 'text', value: '\n', ...(align ? { rowFlex: align } : {}) },
      ];
    }
  }
  return els;
}

function emitList(block, where) {
  const type = block.ordered ? 'ol' : 'ul';
  const style = block.style ?? (block.ordered ? 'decimal' : 'disc');
  if (!LIST_STYLES.includes(style)) warn(`${where}.style="${style}" 非法，按默认处理`);
  if (block.ordered && style !== 'decimal' && style !== 'checkbox') warn(`${where} 有序列表 style 建议 decimal`);
  const items = block.items;
  if (!Array.isArray(items) || !items.length) {
    warn(`${where}.items 为空，已跳过`);
    return [];
  }
  const listId = nextId('tpl-word-list');
  const baseLevel = Number.isInteger(block.level) && block.level >= 0 ? block.level : 0;
  const valueList = [];
  for (const [i, item] of items.entries()) {
    const itemWhere = `${where}.items[${i}]`;
    const itemLevel = Number.isInteger(item?.level) && item.level >= 0 ? item.level : baseLevel;
    let runs;
    if (typeof item === 'string') runs = [{ text: item, style: {} }];
    else if (item && typeof item === 'object') runs = normalizeRuns(item, itemWhere);
    else runs = null;
    if (!runs) continue;
    const shared = { listId, listType: type, listStyle: style, listLevel: itemLevel };
    valueList.push({ value: '\n', ...shared });
    runs.forEach((r, ri) => {
      const parts = r.text.split('\n');
      parts.forEach((part, pi) => {
        if (part) valueList.push({ type: 'text', value: part, ...r.style, ...shared, ...(item.align ? { rowFlex: item.align } : {}) });
        if (pi < parts.length - 1) valueList.push({ value: '\n', listWrap: true, ...shared });
      });
    });
  }
  return [{ type: 'list', value: '', listId, listType: type, listStyle: style, valueList }];
}

function emitTable(block, where) {
  const rows = block.rows;
  if (!Array.isArray(rows) || !rows.length) {
    warn(`${where}.rows 为空，已跳过`);
    return [];
  }
  const borderType = block.borderType ?? 'all';
  if (!BORDER_TYPES.includes(borderType)) warn(`${where}.borderType="${borderType}" 非法，按 all 处理`);
  let colWidths = block.colWidths;
  if (colWidths !== undefined) {
    if (!Array.isArray(colWidths) || !colWidths.every((w) => num(w) && w > 0)) {
      warn(`${where}.colWidths 必须是正数数组，已按等宽处理`);
      colWidths = undefined;
    }
  }
  const trList = [];
  for (const [ri, row] of rows.entries()) {
    const cells = Array.isArray(row) ? row : row.cells;
    if (!Array.isArray(cells) || !cells.length) {
      warn(`${where}.rows[${ri}] 没有 cells，已跳过该行`);
      continue;
    }
    const tdList = cells.map((cell, ci) => {
      const cw = `${where}.rows[${ri}].cells[${ci}]`;
      const runs = normalizeRuns(cell ?? {}, cw);
      const value = (runs ?? []).map((r) => ({ type: 'text', value: r.text, ...r.style, ...(cell.align ? { rowFlex: cell.align } : {}) }));
      if (!value.length) value.push({ type: 'text', value: '' });
      const colspan = Number.isInteger(cell.colspan) && cell.colspan > 0 ? cell.colspan : 1;
      const rowspan = Number.isInteger(cell.rowspan) && cell.rowspan > 0 ? cell.rowspan : 1;
      const td = { colspan, rowspan, value };
      if (num(cell.width) && cell.width > 0) td.width = cell.width;
      if (hex(cell.backgroundColor)) td.backgroundColor = cell.backgroundColor;
      if (['top', 'middle', 'bottom'].includes(cell.verticalAlign)) td.verticalAlign = cell.verticalAlign;
      return td;
    });
    const tr = { tdList };
    if (num(row.height) && row.height > 0) tr.height = row.height;
    if (row.repeatHeader) tr.pagingRepeat = true;
    trList.push(tr);
  }
  if (!colWidths) {
    const cols = Math.max(...trList.map((r) => r.tdList.reduce((s, td) => s + td.colspan, 0)));
    const usable = page.width - page.margin[1] - page.margin[3];
    colWidths = Array.from({ length: cols }, () => Math.floor(usable / cols));
  }
  return [{ type: 'table', value: '', colgroup: colWidths.map((w) => ({ width: w })), borderType, trList }];
}

function resolveImage(src, where) {
  if (typeof src !== 'string' || !src) {
    warn(`${where}.src 缺失，已跳过`);
    return null;
  }
  if (/^data:image\//.test(src)) return src;
  if (/^https?:\/\//.test(src)) {
    warn(`${where}.src 是外链，编辑器需联网加载；建议本地图片路径或 data URL`);
    return src;
  }
  const abs = path.resolve(path.dirname(path.resolve(inFile)), src);
  if (!fs.existsSync(abs)) {
    warn(`${where}.src 文件不存在：${abs}，已跳过`);
    return null;
  }
  const ext = path.extname(abs).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml' }[ext];
  if (!mime) {
    warn(`${where}.src 不支持的图片格式 ${ext}，已跳过`);
    return null;
  }
  return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
}

function emitImage(block, where) {
  const src = resolveImage(block.src, where);
  if (!src) return [];
  const el = { type: 'image', value: src };
  el.width = num(block.width) && block.width > 0 ? block.width : 200;
  el.height = num(block.height) && block.height > 0 ? block.height : undefined;
  if (!el.height) {
    el.height = Math.round(el.width * 0.66);
    warn(`${where}.height 缺省，按 2:3 估算；建议显式给出宽高`);
  }
  if (block.align) el.rowFlex = block.align === 'center' ? 'center' : block.align === 'right' ? 'right' : 'left';
  return [el, { type: 'text', value: '\n' }];
}

function emitBlock(block, i) {
  const where = `content[${i}]`;
  if (!block || typeof block !== 'object') {
    warn(`${where} 不是对象，已跳过`);
    return [];
  }
  switch (block.type ?? 'paragraph') {
    case 'heading':
      return emitHeading(block, where);
    case 'paragraph':
      if (block.hyperlink && !block.text && !block.runs) {
        if (!/^https?:\/\//.test(block.hyperlink)) {
          warn(`${where}.hyperlink 非 http(s)，已跳过`);
          return [];
        }
        return [{ type: 'hyperlink', value: '', url: block.hyperlink, valueList: [{ type: 'text', value: block.label ?? block.hyperlink }] }, { type: 'text', value: '\n' }];
      }
      return emitParagraph(block, where);
    case 'list':
      return emitList(block, where);
    case 'table':
      return emitTable(block, where);
    case 'image':
      return emitImage(block, where);
    case 'pageBreak':
      return [{ type: 'pageBreak', value: '', hide: true }];
    case 'separator':
      return [{ type: 'separator', value: '\n', ...(Array.isArray(block.dashArray) ? { dashArray: block.dashArray } : {}), ...(num(block.lineWidth) ? { lineWidth: block.lineWidth } : {}) }];
    case 'checkbox': {
      const els = [{ type: 'checkbox', value: '', checkbox: { value: !!block.checked } }];
      if (typeof block.text === 'string' && block.text) els.push({ type: 'text', value: ' ' + block.text });
      els.push({ type: 'text', value: '\n' });
      return els;
    }
    case 'spacer':
      return [{ type: 'text', value: '\n'.repeat(Math.max(1, Math.min(10, block.lines ?? 1))) }];
    case 'latex':
      warn(`${where} latex 不支持（需编辑器内由 MathJax 生成 SVG），已跳过`);
      return [];
    default:
      warn(`${where}.type="${block.type}" 未知，按段落处理`);
      return emitParagraph(block, where);
  }
}

const main = blocks.flatMap(emitBlock);
if (!main.length) throw new Error('转换结果为空：content 里没有可用块');

const buildZone = (list, name) => {
  if (!Array.isArray(list)) return undefined;
  const els = list.flatMap((b, i) => emitBlock(b, `${name}[${i}]`));
  return els.length ? els : undefined;
};
const header = buildZone(spec.header, 'header');
const footer = buildZone(spec.footer, 'footer');

const content = { main, ...(header ? { header } : {}), ...(footer ? { footer } : {}) };
const title = typeof spec.title === 'string' && spec.title.trim() ? spec.title.trim() : '未命名文档';
const efw = {
  format: 'efword',
  version: '1.0',
  exportedAt: new Date().toISOString(),
  title,
  source: spec.source ?? { app: '易飞办公', url: 'https://eflink.tech/office/word' },
  data: content,
};

// ───────────────── HTML 预览（A4 版式近似，仅供结构自检） ─────────────────
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const runCss = (r) => {
  const s = [];
  if (r.style?.bold) s.push('font-weight:700');
  if (r.style?.italic) s.push('font-style:italic');
  const deco = [r.style?.underline && 'underline', r.style?.strikeout && 'line-through'].filter(Boolean);
  if (deco.length) s.push(`text-decoration:${deco.join(' ')}`);
  if (r.style?.color) s.push(`color:${r.style.color}`);
  if (r.style?.highlight) s.push(`background:${r.style.highlight}`);
  if (r.style?.size) s.push(`font-size:${r.style.size}px`);
  if (r.style?.font) s.push(`font-family:${r.style.font}`);
  if (r.style?.script === 'super') s.push('vertical-align:super;font-size:.75em');
  if (r.style?.script === 'sub') s.push('vertical-align:sub;font-size:.75em');
  return s.join(';');
};
const alignCss = (a) => (a && a !== 'left' ? `text-align:${a === 'justify' ? 'justify' : a};` : '');

const htmlPages = [];
let pageLines = [];
const flushPage = () => {
  if (!pageLines.length && htmlPages.length) return;
  htmlPages.push(pageLines.join(''));
  pageLines = [];
};

for (const [i, block] of blocks.entries()) {
  const where = `content[${i}]`;
  if (!block || typeof block !== 'object') continue;
  const type = block.type ?? 'paragraph';
  if (type === 'pageBreak') {
    flushPage();
    continue;
  }
  if (type === 'heading') {
    const levelName = typeof block.level === 'number' ? ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][Math.min(5, Math.max(0, block.level - 1))] : block.level ?? 'first';
    const size = block.size ?? TITLE_SIZE[levelName] ?? 24;
    const runs = normalizeRuns(block, where) ?? [];
    pageLines.push(`<h${Math.min(6, (typeof block.level === 'number' ? block.level : 1))} style="font-size:${size}px;margin:.6em 0 .35em;line-height:1.4;${alignCss(block.align)}">${runs.map((r) => `<span style="${runCss(r)}">${esc(r.text)}</span>`).join('')}</h${Math.min(6, (typeof block.level === 'number' ? block.level : 1))}>`);
    continue;
  }
  if (type === 'paragraph') {
    const runs = normalizeRuns(block, where) ?? [];
    let indent = Number.isInteger(block.indent) ? '　'.repeat(block.indent) : '';
    pageLines.push(`<p style="margin:0 0 ${(block.paragraphMargin ?? 8)}px;line-height:1.5;${alignCss(block.align)}${block.size ? `font-size:${block.size}px;` : ''}">${esc(indent)}${runs.map((r) => `<span style="${runCss(r)}">${esc(r.text).replace(/\n/g, '<br>')}</span>`).join('')}</p>`);
    continue;
  }
  if (type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul';
    const items = Array.isArray(block.items) ? block.items : [];
    const lis = items.map((item) => {
      if (typeof item === 'string') return `<li>${esc(item)}</li>`;
      const runs = normalizeRuns(item, where) ?? [];
      const lvl = Number.isInteger(item?.level) ? ` style="margin-left:${item.level * 18}px"` : '';
      return `<li${lvl}>${runs.map((r) => `<span style="${runCss(r)}">${esc(r.text)}</span>`).join('')}</li>`;
    }).join('');
    const style = block.style === 'circle' ? 'circle' : block.style === 'square' ? 'square' : block.ordered ? 'decimal' : 'disc';
    if (block.style === 'checkbox') {
      const lis = (Array.isArray(block.items) ? block.items : []).map((item) => {
        const runs = typeof item === 'string' ? [{ text: item, style: {} }] : normalizeRuns(item, where) ?? [];
        return `<li style="list-style:none"><span style="display:inline-block;width:13px;height:13px;border:1px solid #374151;vertical-align:-2px;margin-right:6px"></span>${runs.map((r) => `<span style="${runCss(r)}">${esc(r.text)}</span>`).join('')}</li>`;
      }).join('');
      pageLines.push(`<ul style="margin:0 0 8px;padding-left:8px;line-height:1.6;list-style:none">${lis}</ul>`);
      continue;
    }
    pageLines.push(`<${tag} style="margin:0 0 8px;padding-left:28px;line-height:1.6;list-style-type:${style}">${lis}</${tag}>`);
    continue;
  }
  if (type === 'table') {
    const cols = block.colWidths ?? [];
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const border = block.borderType ?? 'all';
    const lineCss = border === 'dash' ? '1px dashed #9CA3AF' : '1px solid #9CA3AF';
    // 占位网格：处理 colspan/rowspan 后判断每条边是外框还是内框
    const grid = [];
    const placements = rows.map((row, r) => {
      const cells = Array.isArray(row) ? row : row.cells ?? [];
      const out = [];
      let c = 0;
      for (const cell of cells) {
        while (grid[r]?.[c]) c++;
        const cs = Number.isInteger(cell.colspan) && cell.colspan > 0 ? cell.colspan : 1;
        const rs = Number.isInteger(cell.rowspan) && cell.rowspan > 0 ? cell.rowspan : 1;
        for (let dr = 0; dr < rs; dr++) {
          grid[r + dr] = grid[r + dr] ?? [];
          for (let dc = 0; dc < cs; dc++) grid[r + dr][c + dc] = out.length;
        }
        out.push({ cell, c, cs, rs });
        c += cs;
      }
      return out;
    });
    const rowCount = rows.length;
    const colCount = Math.max(...placements.map((p) => p.reduce((s, x) => s + x.cs, 0)), 0);
    const trs = placements.map((cells, r) => `<tr>${cells.map(({ cell, c, cs, rs }) => {
      const runs = normalizeRuns(cell ?? {}, where) ?? [];
      const csAttr = cs > 1 ? ` colspan="${cs}"` : '';
      const rsAttr = rs > 1 ? ` rowspan="${rs}"` : '';
      const bg = hex(cell.backgroundColor) ? `background:${cell.backgroundColor};` : '';
      const al = cell.align ? `text-align:${cell.align};` : '';
      const va = cell.verticalAlign ? `vertical-align:${cell.verticalAlign};` : '';
      const edge = (isOuter) => {
        if (border === 'empty') return 'none';
        if (border === 'external') return isOuter ? lineCss : 'none';
        if (border === 'internal') return isOuter ? 'none' : lineCss;
        return lineCss;
      };
      const atTop = r === 0;
      const atBottom = r + rs >= rowCount;
      const atLeft = c === 0;
      const atRight = c + cs >= colCount;
      const bTop = edge(atTop);
      const bBottom = edge(atBottom);
      const bLeft = edge(atLeft);
      const bRight = edge(atRight);
      return `<td${csAttr}${rsAttr} style="border-top:${bTop};border-bottom:${bBottom};border-left:${bLeft};border-right:${bRight};padding:4px 6px;${bg}${al}${va}">${runs.map((x) => `<span style="${runCss(x)}">${esc(x.text)}</span>`).join('')}</td>`;
    }).join('')}</tr>`).join('');
    const cg = cols.length ? `<colgroup>${cols.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>` : '';
    pageLines.push(`<table style="border-collapse:collapse;width:100%;margin:6px 0 10px;table-layout:fixed">${cg}${trs}</table>`);
    continue;
  }
  if (type === 'image') {
    const src = resolveImage(block.src, where);
    if (!src) continue;
    const w = num(block.width) ? block.width : 200;
    pageLines.push(`<p style="margin:8px 0;${alignCss(block.align)}"><img src="${src}" style="width:${w}px;height:auto"></p>`);
    continue;
  }
  if (type === 'separator') {
    pageLines.push(`<hr style="border:none;border-top:${num(block.lineWidth) ? block.lineWidth : 1}px ${Array.isArray(block.dashArray) ? 'dashed' : 'solid'} #9CA3AF;margin:10px 0">`);
    continue;
  }
  if (type === 'checkbox') {
    pageLines.push(`<p style="margin:0 0 6px;line-height:1.6"><span style="display:inline-block;width:13px;height:13px;border:1px solid #374151;vertical-align:-2px;text-align:center;font-size:12px">${block.checked ? '✓' : ''}</span> ${esc(block.text ?? '')}</p>`);
    continue;
  }
  if (type === 'spacer') {
    pageLines.push(`<div style="height:${(block.lines ?? 1) * 24}px"></div>`);
    continue;
  }
}
flushPage();

const zoneHtml = (list, name) => {
  if (!Array.isArray(list)) return '';
  const tmp = pageLines;
  pageLines = [];
  for (const [i, b] of list.entries()) {
    // 复用主渲染：临时拼一个只含该块的对象
    const t = b?.type ?? 'paragraph';
    if (t === 'paragraph') {
      const runs = normalizeRuns(b, `${name}[${i}]`) ?? [];
      pageLines.push(`<div>${runs.map((r) => `<span style="${runCss(r)}">${esc(r.text)}</span>`).join('')}</div>`);
    } else if (t === 'table') {
      const rows = Array.isArray(b.rows) ? b.rows : [];
      pageLines.push(`<table style="border-collapse:collapse;width:100%">${rows.map((row) => `<tr>${(row.cells ?? row).map((c) => `<td style="border:1px solid #9CA3AF;padding:2px 4px">${esc(c.text ?? '')}</td>`).join('')}</tr>`).join('')}</table>`);
    }
  }
  const html = pageLines.join('');
  pageLines = tmp;
  return html;
};
const headerHtml = zoneHtml(spec.header, 'header');
const footerHtml = zoneHtml(spec.footer, 'footer');

const pageCss = `width:${page.width}px;min-height:${page.height}px;margin:18px auto;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.18);padding:${page.margin[0]}px ${page.margin[1]}px ${page.margin[2]}px ${page.margin[3]}px;box-sizing:border-box;position:relative;font-family:'${page.font}',sans-serif;font-size:${page.size}px;color:#111;display:flex;flex-direction:column;`;
const pageHtml = htmlPages.map((body) => `<section style="${pageCss}">${headerHtml ? `<div style="border-bottom:1px solid #D1D5DB;color:#6B7280;font-size:13px;margin-bottom:12px;padding-bottom:4px">${headerHtml}</div>` : ''}<div style="flex:1">${body}</div>${footerHtml ? `<div style="border-top:1px solid #D1D5DB;color:#6B7280;font-size:13px;margin-top:18px;padding-top:4px">${footerHtml}</div>` : ''}</section>`).join('\n');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{margin:0;background:#EDEFF2;padding:8px 0}h1,h2,h3,h4,h5,h6{font-weight:700}</style></head><body>${pageHtml}</body></html>`;

// ───────────────── 写文件 ─────────────────
const base = path.basename(inFile).replace(/\.json$/i, '');
fs.mkdirSync(outDir, { recursive: true });
const efwPath = path.join(outDir, `${base}.efw.json`);
const contentPath = path.join(outDir, `${base}.content.json`);
const htmlPath = path.join(outDir, `${base}.html`);
fs.writeFileSync(efwPath, JSON.stringify(efw, null, 2));
fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
fs.writeFileSync(htmlPath, html);

const countText = (els) => els.reduce((s, e) => s + (typeof e.value === 'string' ? e.value.replace(/\n/g, '').length : 0), 0);
console.log(`OK ${base}: 正文块 ${blocks.length}，字符 ${countText(main)}，页面 ${htmlPages.length}${header ? '，含页眉' : ''}${footer ? '，含页脚' : ''}`);
console.log(`  ${efwPath}`);
console.log(`  ${contentPath}`);
console.log(`  ${htmlPath}`);
if (warnings.length) {
  console.error(`⚠ ${warnings.length} 条警告:`);
  for (const w of warnings) console.error(`  - ${w}`);
}

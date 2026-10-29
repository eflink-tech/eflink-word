/**
 * 真实 docx 批量导入审计（默认跳过，需显式指定语料目录）：
 *
 *   EFLINK_DOCX_DIR=/path/to/docx \
 *   EFLINK_DOCX_REPORT=/tmp/report.json \
 *   pnpm --filter @eflink-tech/word test realDocx
 *
 * 统计源文档与导入结果的结构/文本量，定位丢失内容的特性（文本框、脚注、
 * 修订、域等）。断言仅保证每个文件都能导入且有基本输出，细节看报告。
 */
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import type { IElement } from '@hufe921/canvas-editor'
import { createDocxImporter } from '../importDocx'

const corpusDir = process.env.EFLINK_DOCX_DIR
const reportFile = process.env.EFLINK_DOCX_REPORT
const maybe = corpusDir ? describe : describe.skip

interface Stats {
  textChars: number
  tables: number
  images: number
  hyperlinks: number
  footnotes: number
  textboxes: number
  trackedIns: number
  trackedDel: number
  pageFields: number
  paragraphs: number
}

function emptyStats(): Stats {
  return {
    textChars: 0,
    tables: 0,
    images: 0,
    hyperlinks: 0,
    footnotes: 0,
    textboxes: 0,
    trackedIns: 0,
    trackedDel: 0,
    pageFields: 0,
    paragraphs: 0
  }
}

// mc:Fallback 是 mc:Choice 的等价副本，统计时只取 Choice 避免重复计数
function inFallback(element: Element): boolean {
  let parent = element.parentElement
  while (parent) {
    if (parent.tagName === 'mc:Fallback') return true
    parent = parent.parentElement
  }
  return false
}

function xmlStats(xml: string): Stats {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const stats = emptyStats()
  const text = Array.from(doc.getElementsByTagName('w:t'))
    .filter(t => !inFallback(t))
    .map(t => t.textContent || '')
    .join('')
  stats.textChars = text.replace(/\s+/g, '').length
  stats.tables = doc.getElementsByTagName('w:tbl').length
  stats.images =
    doc.getElementsByTagName('a:blip').length +
    doc.getElementsByTagName('v:imagedata').length
  stats.hyperlinks = doc.getElementsByTagName('w:hyperlink').length
  stats.footnotes =
    doc.getElementsByTagName('w:footnoteReference').length +
    doc.getElementsByTagName('w:endnoteReference').length
  stats.textboxes = Array.from(
    doc.getElementsByTagName('w:txbxContent')
  ).filter(el => !inFallback(el)).length
  stats.trackedIns =
    doc.getElementsByTagName('w:ins').length +
    doc.getElementsByTagName('w:moveTo').length
  stats.trackedDel =
    doc.getElementsByTagName('w:del').length +
    doc.getElementsByTagName('w:moveFrom').length
  stats.pageFields = Array.from(doc.getElementsByTagName('w:instrText')).filter(
    node => /\bPAGE\b|\bNUMPAGES\b/.test(node.textContent || '')
  ).length
  stats.paragraphs = doc.getElementsByTagName('w:p').length
  return stats
}

function addStats(target: Stats, source: Stats) {
  for (const key of Object.keys(target) as (keyof Stats)[]) {
    target[key] += source[key]
  }
}

interface ImportedStats {
  textChars: number
  elements: number
  tables: number
  tableCells: number
  images: number
  lists: number
  titles: number
  hyperlinks: number
  controls: number
  pageBreaks: number
  textboxesKept: number
}

function collectElements(
  elements: IElement[] | undefined,
  stats: ImportedStats,
  depth = 0
) {
  if (!elements || depth > 12) return
  for (const el of elements) {
    if (el.type === 'table' && el.trList) {
      stats.tables++
      for (const tr of el.trList) {
        stats.tableCells += tr.tdList.length
        for (const td of tr.tdList) collectElements(td.value, stats, depth + 1)
      }
      continue
    }
    stats.elements++
    if (el.type === 'image') stats.images++
    if (el.type === 'list') stats.lists++
    if (el.type === 'title') stats.titles++
    if (el.type === 'hyperlink') stats.hyperlinks++
    if (el.type === 'control') stats.controls++
    if (el.type === 'pageBreak') stats.pageBreaks++
    if (el.value && el.type !== 'image') {
      stats.textChars += el.value.replace(/\s+/g, '').length
    }
    if (el.valueList?.length) collectElements(el.valueList, stats, depth + 1)
  }
}

maybe('real docx corpus', () => {
  it('imports every docx and reports lossy features', async () => {
    const dir = corpusDir as string
    const files = fs
      .readdirSync(dir)
      .filter(name => name.toLowerCase().endsWith('.docx'))
      .sort()
    expect(files.length).toBeGreaterThan(0)
    const report: Array<Record<string, unknown>> = []
    let failed = 0
    for (const file of files) {
      const buffer = fs.readFileSync(path.join(dir, file))
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      )
      const zip = await JSZip.loadAsync(arrayBuffer)
      const source = emptyStats()
      for (const name of Object.keys(zip.files)) {
        if (!/(^word\/document\.xml$|^word\/(header|footer)\d*\.xml$)/.test(name)) {
          continue
        }
        addStats(source, xmlStats(await zip.files[name].async('text')))
      }
      // 脚注/尾注正文单独统计，便于解释覆盖率缺口
      for (const name of ['word/footnotes.xml', 'word/endnotes.xml']) {
        const entry = zip.file(name)
        if (!entry) continue
        const text = Array.from(
          new DOMParser()
            .parseFromString(await entry.async('text'), 'application/xml')
            .getElementsByTagName('w:t')
        )
          .map(t => t.textContent || '')
          .join('')
        source.textChars += text.replace(/\s+/g, '').length
      }

      const command = {
        executeSetValue: vi.fn(),
        executeUpdateOptions: vi.fn(),
        getValue: vi.fn(() => ({ options: {} }))
      }
      const started = performance.now()
      let error: unknown = null
      try {
        await createDocxImporter(command as never)({ arrayBuffer })
      } catch (err) {
        error = err
        failed++
      }
      const elapsed = Math.round(performance.now() - started)
      const data = command.executeSetValue.mock.calls[0]?.[0] as
        | { main?: IElement[]; header?: IElement[]; footer?: IElement[] }
        | undefined
      const imported: ImportedStats = {
        textChars: 0,
        elements: 0,
        tables: 0,
        tableCells: 0,
        images: 0,
        lists: 0,
        titles: 0,
        hyperlinks: 0,
        controls: 0,
        pageBreaks: 0,
        textboxesKept: 0
      }
      collectElements(data?.main, imported)
      collectElements(data?.header, imported)
      collectElements(data?.footer, imported)
      const options = command.executeUpdateOptions.mock.calls[0]?.[0] as
        | Record<string, unknown>
        | undefined
      report.push({
        file,
        ms: elapsed,
        error: error ? String((error as Error).message || error) : null,
        source,
        imported,
        coverage:
          source.textChars > 0
            ? Math.round((imported.textChars / source.textChars) * 1000) / 1000
            : null,
        hasPageSetup: !!options?.width,
        hasWatermark: !!(options?.watermark as { data?: string })?.data,
        pageNumberFormat:
          (options?.pageNumber as { format?: string })?.format ?? null,
        footerCount: data?.footer?.length ?? null
      })
    }
    if (reportFile) {
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
    }
    // 终端摘要
    for (const row of report) {
      const r = row as {
        file: string
        ms: number
        coverage: number | null
        error: string | null
        source: Stats
        imported: ImportedStats
      }
      // eslint-disable-next-line no-console
      console.log(
        [
          r.file.padEnd(38),
          `${r.ms}ms`.padStart(7),
          `text ${r.imported.textChars}/${r.source.textChars}`,
          `cov ${r.coverage ?? '-'}`,
          `tbl ${r.imported.tables}/${r.source.tables}`,
          `img ${r.imported.images}/${r.source.images}`,
          r.source.textboxes ? `txbx ${r.source.textboxes}` : '',
          r.source.footnotes ? `note ${r.source.footnotes}` : '',
          r.source.trackedIns || r.source.trackedDel
            ? `rev +${r.source.trackedIns}/-${r.source.trackedDel}`
            : '',
          r.error ? `ERROR ${r.error}` : ''
        ]
          .filter(Boolean)
          .join(' ')
      )
    }
    expect(failed).toBe(0)
  }, 180_000)
})

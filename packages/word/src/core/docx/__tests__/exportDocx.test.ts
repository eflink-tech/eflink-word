import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import type Editor from '@hufe921/canvas-editor'
import { createDocxExporter } from '../exportDocx'

/** 最小编辑器替身：exportDocx 只读 command.getValue() */
function makeMockEditor(main: Array<Record<string, unknown>>): Editor {
  return {
    command: {
      getValue: () => ({
        data: { header: [], footer: [], main },
        options: {
          defaultSize: 16,
          defaultRowMargin: 1,
          defaultBasicRowMarginHeight: 8,
          width: 794,
          height: 1123,
          margins: [96, 120, 96, 120],
          paperDirection: 0,
          watermark: { data: '' },
        },
      }),
    },
  } as unknown as Editor
}

describe('createDocxExporter', () => {
  it('导出文本段落：解包后 document.xml 包含原文', async () => {
    const editor = makeMockEditor([{ value: '你好，世界' }])
    const exporter = createDocxExporter(editor)
    const blob = await exporter({ fileName: '测试文档' })

    expect(blob).toBeInstanceOf(Blob)
    const zip = await JSZip.loadAsync(blob)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('你好，世界')
  })

  it('导出粗体文本：document.xml 包含 <w:b/>', async () => {
    const editor = makeMockEditor([
      { value: '加粗', bold: true, size: 16, font: 'Microsoft YaHei' },
    ])
    const blob = await createDocxExporter(editor)({ fileName: '粗体' })
    const zip = await JSZip.loadAsync(blob)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:b/>')
  })

  it('不触发浏览器下载（下载职责上移到入口层）', async () => {
    const editor = makeMockEditor([{ value: 'x' }])
    const anchorSpy = vi.spyOn(document.body, 'append')
    await createDocxExporter(editor)({ fileName: '不下载' })
    expect(anchorSpy).not.toHaveBeenCalled()
    anchorSpy.mockRestore()
  })
})

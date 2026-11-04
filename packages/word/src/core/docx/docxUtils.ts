/**
 * 收编自 @hufe921/canvas-editor-plugin-docx（MIT License）
 * 上游: https://github.com/Hufe921/canvas-editor-plugin
 * 收编版本: commit 7b630c1c8afdbf3d63f94f2ea5b9e69b2da60b04（2026-09-12）
 * 除本文件头外仅做计划列出的定点适配，保持与上游一致便于 diff。
 */
import { saveAs } from 'file-saver';
export { saveAs };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// docx 数值解析容错：剥离单位后缀（如 "42.67pt"）与空白
export function parseDocxNumber(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Chromium 对未挂载到文档的 canvas 会忽略大部分字体族（只认默认字体），
// 量出的宽度与挂载后实际绘制不一致，依赖这些宽度的换行/分页就会错位。
// 统一用挂在 body 上的隐藏 canvas 测量，保证与编辑器绘制同源。
let measureCanvas: HTMLCanvasElement | null | undefined
export function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCanvas === undefined) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 8
      canvas.height = 8
      canvas.style.cssText =
        'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none'
      ;(document.body || document.documentElement).appendChild(canvas)
      measureCanvas = canvas
    } catch {
      measureCanvas = null
    }
  }
  return measureCanvas ? measureCanvas.getContext('2d') : null
}

// 字体字面高度（canvas measureText('中')，导入导出与编辑器渲染同源）
const fontMetricsCache = new Map<string, { ascent: number; descent: number }>()
export function measureFontMetrics(
  font: string | undefined,
  size: number
): { ascent: number; descent: number } {
  const key = `${font}-${size}`
  const cached = fontMetricsCache.get(key)
  if (cached) return cached
  let metrics = { ascent: size * 0.86, descent: size * 0.14 }
  try {
    const ctx = getMeasureContext()
    if (ctx) {
      ctx.font = `${size}px ${font || 'sans-serif'}`
      const m = ctx.measureText('中')
      if (m.actualBoundingBoxAscent && m.actualBoundingBoxDescent) {
        metrics = {
          ascent: m.actualBoundingBoxAscent,
          descent: m.actualBoundingBoxDescent
        }
      }
    }
  } catch {
    // 非浏览器环境使用估算值
  }
  fontMetricsCache.set(key, metrics)
  return metrics
}

// 文本宽度测量（canvas measureText）
const textWidthCache = new Map<string, number>()
export function measureTextWidth(
  font: string | undefined,
  size: number,
  text: string
): number {
  const key = `${font}-${size}-${text}`
  const cached = textWidthCache.get(key)
  if (cached !== undefined) return cached
  let width = text.length * size
  try {
    const ctx = getMeasureContext()
    if (ctx) {
      ctx.font = `${size}px ${font || 'sans-serif'}`
      width = ctx.measureText(text).width || width
    }
  } catch {
    // 非浏览器环境按字符数估算
  }
  textWidthCache.set(key, width)
  return width
}

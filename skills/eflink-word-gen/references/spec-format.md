# WordSpec 格式

spec 是**块数组**（无坐标、无 id）。转换器负责换行、编号、列表合并、表格结构与图片内联。
所有枚举字段写错不会报错而是**忽略并打警告**（转换后必须核对 stderr 的 ⚠ 清单）。

## 顶层结构

```json
{
  "title": "文档标题（作为文件名与 .efw.json 的 title）",
  "page": {
    "paperSize": "A4",
    "direction": "vertical",
    "margin": [100, 120, 100, 120],
    "defaultFont": "Microsoft YaHei",
    "defaultSize": 16
  },
  "header": [ /* 块数组，每页重复；可省略 */ ],
  "footer": [ /* 块数组，每页重复；可省略 */ ],
  "content": [ /* 块数组，必填，按顺序排正文 */ ]
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| title | 否 | 缺省“未命名文档”；不含路径非法字符 |
| page | 否 | 只影响 HTML 预览。A4=794×1123，margin 顺序 [上,右,下,左]，direction=horizontal 时交换宽高 |
| header / footer | 否 | 与 content 相同的块数组；通常各一个段落 |
| content | **是** | 正文块，顺序即排版顺序 |

## 块类型

### heading（标题）

```json
{ "type": "heading", "level": 1, "text": "一、总体要求", "align": "left", "color": "#C00000", "size": 24, "runs": [...] }
```

- `level`：1~6；未写 `size` 时按 32/24/19/17/15/14 自动补。
- `align`：`left/center/right/justify`。
- 文字可用 `text`（整段同样式）或 `runs`（行内混排）。

### paragraph（段落）

```json
{ "type": "paragraph", "text": "正文…", "indent": 2, "align": "left", "size": 16, "rowMargin": 1.2,
  "runs": [{ "text": "加粗", "bold": true }, { "text": "普通" }] }
```

| 字段 | 说明 |
| --- | --- |
| text / runs | 二选一；runs 优先。每个 run 的 `text` 必填 |
| indent | 首行缩进字数 0~12（转换器用全角空格近似） |
| align | 行对齐 |
| size / rowMargin | 整段字号/行距倍数（rowMargin 1=单倍，1.5=1.5 倍） |
| hyperlink | 整段变成超链接，值为 http(s) URL；配合 `text`/`runs` 显示文字 |

**run 字段**：`text`（必填）、`bold`、`italic`、`underline`、`strikeout`、`color`(#RRGGBB)、
`highlight`(#RRGGBB)、`size`(8~96)、`font`、`letterSpacing`、`script`(`super`/`sub`)。

### list（列表）

```json
{ "type": "list", "ordered": true, "style": "decimal", "items": [
  "第一项",
  { "text": "第二项（加粗）", "bold": true },
  { "text": "子项", "level": 1 }
] }
```

- `ordered`：true 为有序（1. 2. 3.），false 为无序。
- `style`：`disc` / `circle` / `square` / `decimal` / `checkbox`。
  `checkbox` 列表项在编辑器里是可点击复选框。
- `items[]`：字符串，或 `{text|runs, level, align, bold/color/size...}`。
- 项内软换行（字符串里的 `\n`）不会拆成新编号。

### table（表格）

```json
{ "type": "table", "borderType": "all", "colWidths": [90, 170, 90, 220],
  "rows": [
    { "height": 28, "repeatHeader": true, "cells": [
      { "text": "序号", "bold": true, "color": "#FFFFFF", "backgroundColor": "#2F5597", "align": "center" },
      { "text": "事项", "backgroundColor": "#2F5597", "color": "#FFFFFF" }
    ] },
    { "height": 26, "cells": [
      { "text": "1", "align": "center" },
      { "text": "内容", "colspan": 1, "rowspan": 1, "verticalAlign": "middle" }
    ] }
  ] }
```

| 字段 | 说明 |
| --- | --- |
| borderType | `all`(全框线) / `empty`(无框线) / `external`(外框) / `internal`(内框) / `dash`(虚线) |
| colWidths | 每列宽 px；省略时按正文宽度等分 |
| rows[] | 行；`height` px，`repeatHeader` 跨页重复表头 |
| cells[] | 单元格；`text` 或 `runs`；`colspan`/`rowspan`/`width`/`backgroundColor`/`align`(left/center/right)/`verticalAlign`(top/middle/bottom) |
| cell 样式 | `bold`/`color`/`size`/`italic` 等直接写在单元格上 |

列宽之和建议 ≤ 554（A4 默认页边距下的正文宽度）。

### image（图片）

```json
{ "type": "image", "src": "./logo.png", "width": 180, "height": 60, "align": "center" }
```

`src` 支持本地文件（相对 spec 路径）、`data:image/...;base64,...`、http(s) 外链（会警告）。

### 其它块

| 块 | 写法 | 说明 |
| --- | --- | --- |
| 分页符 | `{ "type": "pageBreak" }` | 强制换页 |
| 分隔线 | `{ "type": "separator", "lineWidth": 1, "dashArray": [4,3] }` | 去掉 dashArray 为实线 |
| 复选框 | `{ "type": "checkbox", "checked": true, "text": "已阅读" }` | 行内可点击复选框 + 说明 |
| 空行 | `{ "type": "spacer", "lines": 1 }` | 1~10 行 |
| 超链接块 | `{ "type": "paragraph", "hyperlink": "https://…", "label": "官网" }` | 只有超链接的段落 |

不支持 LaTeX（需要编辑器内 MathJax 生成 SVG）；遇到会警告并跳过。

## 颜色/字号速查

- 公文红头：`#C00000`；正文黑 `#111111`；次要灰 `#595959`；表头蓝底 `#2F5597` + 白字 `#FFFFFF`。
- 正文字号 16；表格正文 14~16；页眉页脚 12~13；一级标题 32、二级 24、三级 19。

## 输出文件

| 文件 | 用途 |
| --- | --- |
| `.efw.json` | 编辑器「文件 → 导入文件」；含 format/version/exportedAt/title/source/data |
| `.content.json` | `{main,header?,footer?}`，模板入库 `office_template_content.content` 原样写入 |
| `.html` | 版式预览；自动分页/精确行距以编辑器为准 |

---
name: eflink-word-gen
description: "生成易飞 Word（eflink-word）可编辑文件。从文字描述或截图（如 ProcessOn/Word 模板）产出 .efw.json（编辑器『导入文件』直接打开）+ .content.json（模板入库）+ HTML 版式预览，支持标题、段落与行内样式（粗斜下划线/颜色/高亮/上下标）、有序/无序/复选列表、表格（合并单元格/底色/边框类型/表头重复）、图片、超链接、分隔线、复选框、分页、页眉页脚。Use when: (1) 用户要求生成合同/通知/公文/报告/简历等 Word 文档或模板, (2) 提到 .efw.json / efword / 易飞 Word / efword 模板, (3) 把截图或 Markdown 转成易飞 Word 可编辑内容, (4) 批量生产 Word 模板入库。"
---

# eflink-word 文档生成

把文档（文字描述、Markdown 或截图）转成易飞 Word 编辑器原生可编辑文件。核心是写 **WordSpec JSON**
（块数组，无坐标），用打包的转换器生成：

- `.efw.json` —— `EfwordFile` 包装（`{format:'efword',version:'1.0',title,source,data}`），
  编辑器顶栏「文件 → 导入文件」直接打开；
- `.content.json` —— `{main,header?,footer?}`（canvas-editor `IEditorData`），
  模板入库时作为 `office_template_content.content` 原样写入；
- `.html` —— A4 版式预览，用于自检和交付预览图。

## 工作流

1. **读约束**：先读 [references/constraints.md](references/constraints.md)（短，必读——换行/列表/
   表格的写法有硬性要求，违反会渲染错乱或导入失败）。
2. **写 spec**：块格式、全部字段、枚举取值见 [references/spec-format.md](references/spec-format.md)。
   结构细节参考 [assets/examples/company-notice.json](assets/examples/company-notice.json)
   （红头通知：标题+表格+列表+复选框+页眉页脚）。
3. **转换**：
   ```bash
   node <skill目录>/scripts/word_convert.mjs my-spec.json -o ./out
   # 产出 my-spec.efw.json / my-spec.content.json / my-spec.html
   # stderr 的 ⚠ 警告必须逐条核对（非法字段会被忽略而不是报错）
   ```
4. **自检**：HTML 预览转 PNG 检查版式（可 Read 图片）：
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
     --screenshot=preview.png --window-size=900,1300 --hide-scrollbars file://$(pwd)/out/my-spec.html
   ```
   核对：标题层级、缩进、表格边框/合并/底色、列表编号、复选框、页眉页脚位置、文字无截断。
   预览为近似排版（自动分页与行距由编辑器排版引擎完成），重点看内容结构而不是逐像素。
5. **交付**：给用户 `.efw.json` 路径（编辑器「文件 → 导入文件」打开；/office/word 页面）
   + 预览图。需要入库模板时用 `.content.json`。

## 写作要点

- 正文段落逐段写，`indent: 2` 表示首行缩进两字（转换器用全角空格近似，编辑器无段落缩进属性）。
- 行内混排用 `runs`；整段样式可直接写在 paragraph 上（`bold/color/size` 等）。
- 表格一个 `rows[]` 一行，单元格 `text` 或 `runs`，`colspan/rowspan/backgroundColor/align` 控制版式；
  列宽 `colWidths` 建议显式给出（单位 px，正文区约 554px @ A4 默认页边距）。
- 复选框用 `{"type":"checkbox","checked":true,"text":"…"}`，不要在图里写字面 ☑。
- 页眉页脚是块数组（通常一个段落），每页重复。
- 字号单位 px：正文 16，一级标题 32、二级 24、三级 19（转换器会按 level 自动补）。

## 可选：入库为模板草稿

`.content.json` 作为 `office_template_content.content` 写入本地库（localhost:3306/eflink-tech），
`office_template` 行 type=**11**（word）、status=0 草稿、author_name 标来源。批量入库参考
`eflink-backend/scripts/seed-templates.mjs` 的 upsert 模式，以及仓库里
`scripts/word-templates/gen.mjs` 的 50 篇模板 DSL 与 SQL 转义经验（先转义反斜杠再转义单引号）。
涉及数据库写入先和用户确认。

## 维护提示

转换器按 canvas-editor `IEditorData` 快照生成（`@hufe921/canvas-editor@1.0.2`，eflink-word 内有 patch）。
格式升级时对照：
- 导出/导入实现：`eflink-word/packages/word/src/core/utils/exportImport.ts`
- docx 导入的元素构造（最完整的元素样例）：`eflink-word/packages/word/src/core/docx/importDocx.ts`
- 编辑器默认页面：A4 794×1123，页边距 [100,120,100,120]，默认字体 Microsoft YaHei / 16px
- 可编辑文件格式：`.efw.json` = `EfwordFile`；模板内容 = `{main,header,footer}`

# 设计：eflink-word 支持 .docx 导入导出

- 日期：2026-09-18
- 状态：已与需求方确认
- 范围：`packages/word`（`@eflink-tech/word`）

## 背景与目标

eflink-word 基于 `@hufe921/canvas-editor`（canvas 渲染编辑器）。当前导入仅支持 `.efword`（JSON），导出支持 `.efword` / PDF / 图片，无任何 docx 能力。

**目标**：实现「打开 docx → 编辑 → 存回 docx」的双向闭环，保真标准为**常规办公文档**（合同、通知、报告类：段落、标题、表格、图片、页眉页脚）；文本框、SmartArt 等复杂排版允许降级丢失。

## 方案选型

| 方案 | 说明 | 结论 |
|---|---|---|
| A. 直接安装官方插件包 | `@hufe921/canvas-editor-plugin-docx` 依赖引入 | 否：黑盒、低维护、英文报错、不可定制 |
| **B. 收编插件源码进包内（选定）** | 约 2800 行插件源码迁入 `core/docx/`，保留 MIT 版权声明 | ✅ 可控：可修 bug、中文报错、按兼容矩阵逐步增强 |
| C. 后端转换（Kotlin + Apache POI） | 服务端解析/生成 docx | 否：映射难题不变，工作量翻倍，目标场景收益有限 |

兼容性依据：插件 peer 依赖 `canvas-editor >= 0.9.42`，官方即基于我们使用的 `1.0.2` 开发，可直接配套。

## 模块结构

```
packages/word/src/core/docx/
├── importDocx.ts      # docx ArrayBuffer → IEditorData（JSZip 解析 document.xml/styles.xml/numbering/media）
├── exportDocx.ts      # IEditorData → docx Blob（docx 库构建 OOXML）
├── docxUtils.ts       # 单位换算（twip/EMU/半磅 ↔ px）、字体度量、颜色工具
├── types.ts           # 收编后的类型定义
└── __tests__/         # 单测 + fixtures
```

- 源码来自官方 `canvas-editor-plugin-docx`（MIT），文件头保留版权声明
- 与现有 `core/utils/exportImport.ts`（.efword/PDF/图片）分开，不合并
- **动态 import 加载**：入口处 `await import('...')`，vite 自动 code-split，`docx` + `jszip`（约 300–400KB）不进主包

## UI 入口（ToolbarMenu.tsx 文件菜单）

- 导出组新增 **「导出 Word (.docx)」**，置于「导出文档 (.efword)」之前（高频操作优先）
- 新增 **「导入 Word (.docx)」**，accept 限定 `.docx`，扩展名误传时给明确中文报错
- 导入行为与 `.efword` 一致：**覆盖**当前文档内容（`executeSetValue`），不追加、不加二次确认
- 复用 `LoadingDialog` 模式：新增 `docxImporting` / `docxExporting` 状态 + 遮罩
- 错误处理补强：docx 路径失败时弹出轻量错误对话框（现有导入导出仅 `console.error`，用户无感知），提示中文原因，如「不支持的旧版 .doc 格式，请另存为 .docx 后重试」

## 兼容范围

| 级别 | 内容 | 说明 |
|---|---|---|
| ✅ 支持 | 段落与文字样式（粗/斜/下划线/删除线、字体、字号、颜色、高亮、对齐、行距）、标题 1–6、列表、超链接、表格（边框/合并/对齐）、图片（内嵌 + 基础浮动）、分页符、页眉页脚、纸张方向/边距 | 收编后即达到 |
| ⚠️ 部分支持 | 复选框控件、公式、目录字段 | 有限支持，视具体结构 |
| ❌ 不支持 | 文本框/形状、SmartArt、艺术字、修订痕迹、批注、分栏 | 导入时降级为纯文本或丢失 |
| ❌ 不支持 | 老版 `.doc` 二进制格式 | 明确报错引导另存为 .docx |

## 依赖

新增运行时依赖（均进 `@eflink-tech/word` dependencies）：

- `docx@^9.7.1` — 生成 docx。**不沿用插件锁定的 `^8.2.2`**：8.x 已停更；9.x 唯一主要 breaking change 是 `patchDocument`（模板 patch 场景）API，插件与我们未使用；9.x 增量收益包括持续维护、`firstLineChars` 中文首行缩进按字符（实用）、SVG 图片等。收编时如有类型/API 细微差异直接在收编代码中适配，由 round-trip 测试验证。
- `jszip` — 解包 docx
- `color` — 颜色处理（插件依赖）

## 测试策略

1. **纯函数单测**（vitest，对齐现有测试体系）：单位换算、颜色解析、字号映射
2. **Round-trip 集成测试**：JSZip 在测试内现场构造最小 docx fixtures（段落/标题/表格/图片/页眉页脚）→ `importDocx` → 断言 `IEditorData` 结构；`exportDocx` → 解包 zip → 断言 document.xml 关键节点
3. **真实文档手动验收**：准备典型 Word 文档（合同/通知/带表格报告）逐项对照兼容矩阵

## 决策记录

1. 导入 docx 直接覆盖当前文档，不加二次确认（与 `.efword` 行为一致）
2. 「导出 Word (.docx)」菜单项置于导出组首位（闭环场景下高频）
3. `docx` 库直接采用 `^9.7.1` 而非插件的 `^8.2.2`（收编源码后自主可控，测试兜底）

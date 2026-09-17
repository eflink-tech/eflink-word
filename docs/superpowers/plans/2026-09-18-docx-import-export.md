# eflink-word docx 导入导出 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `@eflink-tech/word` 增加 .docx 导入（覆盖当前文档）与导出（浏览器下载）能力，收编官方 canvas-editor-plugin-docx 源码并适配 docx@9。

**Architecture:** 把官方插件（MIT）三个源文件收编进 `packages/word/src/core/docx/`，去掉插件注册层、改为显式工厂函数；新增 `core/docx/index.ts` 作为统一入口（动态 import 分包 + 旧版 .doc 拦截）；ToolbarMenu 文件菜单接入两个菜单项 + loading 遮罩 + 错误弹窗。

**Tech Stack:** canvas-editor 1.0.2、docx@^9.7.1、JSZip、color、file-saver、Vitest + jsdom

**设计文档:** `docs/superpowers/specs/2026-09-18-docx-import-export-design.md`（commit 6f16897）

**上游源码（pinned）:** https://github.com/Hufe921/canvas-editor-plugin @ commit `7b630c1c8afdbf3d63f94f2ea5b9e69b2da60b04`，目录 `packages/docx/src/docx/`（importDocx.ts 1859 行 / exportDocx.ts 919 行 / utils.ts 80 行）

**收编原则:** 大文件保持上游原貌（含无分号风格），只做计划中列出的定点修改，便于将来 diff 上游；`importDocx.ts`/`exportDocx.ts` 超过 800 行规范属收编豁免。所有工作目录为 `eflink-word/packages/word/`。

**注意:** 本包所有测试命令均为 `pnpm --filter @eflink-tech/word test`（在 `eflink-word/` 仓库根执行）；vitest 环境为 jsdom。

---

## 文件结构

```
packages/word/
├── package.json                              # 修改：+docx@^9.7.1 / +jszip / +color / -D @types/color
└── src/
    ├── core/docx/                            # 新目录（收编）
    │   ├── docxUtils.ts                      # 收编上游 utils.ts（saveAs 改用 file-saver）
    │   ├── importDocx.ts                     # 收编上游 importDocx.ts（工厂函数改名 + 中文报错）
    │   ├── exportDocx.ts                     # 收编上游 exportDocx.ts（工厂函数改名 + 不负责下载）
    │   ├── index.ts                          # 新增：统一入口（.doc 拦截 + 动态加载）
    │   └── __tests__/
    │       ├── fixtures.ts                   # JSZip 现场构造最小 docx
    │       ├── docxUtils.test.ts             # parseDocxNumber 纯函数单测
    │       ├── docxIO.test.ts                # .doc 拦截测试
    │       ├── importDocx.test.ts            # docx → IEditorData 集成测试
    │       └── exportDocx.test.ts            # IEditorData → docx round-trip 测试
    └── components/
        ├── common/ErrorDialog.tsx            # 新增：错误弹窗（仿 ConfirmDialog）
        └── toolbar/ToolbarMenu.tsx           # 修改：菜单项 / loading / 错误弹窗 / 隐藏 input
```

**与设计文档的偏差说明:** 设计文档模块结构中有 `types.ts`；实际收编后 `IImportDocxOption` / `IExportDocxOption` 已随上游源码分别定义在 `importDocx.ts` / `exportDocx.ts` 内，无需单独文件（遵循上游原貌原则），故省略。

---

### Task 1: 安装依赖

**Files:**
- Modify: `packages/word/package.json`

- [ ] **Step 1: 安装运行时与开发依赖**

在 `eflink-word/` 仓库根执行：

```bash
pnpm --filter @eflink-tech/word add docx@^9.7.1 jszip color
pnpm --filter @eflink-tech/word add -D @types/color
```

- [ ] **Step 2: 验证类型可用**

```bash
cd packages/word && node -e "import('docx').then(m => console.log(typeof m.Document, typeof m.ImageRun))"
```

Expected: `function function`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 引入 docx@9 / jszip / color 依赖，为 docx 导入导出做准备"
```

---

### Task 2: 收编上游源码（verbatim copy）

**Files:**
- Create: `packages/word/src/core/docx/docxUtils.ts`（← 上游 `utils.ts`）
- Create: `packages/word/src/core/docx/importDocx.ts`（← 上游 `importDocx.ts`）
- Create: `packages/word/src/core/docx/exportDocx.ts`（← 上游 `exportDocx.ts`）

- [ ] **Step 1: 克隆上游仓库（pinned commit）并复制三个文件**

```bash
cd /tmp && rm -rf canvas-editor-plugin
git clone https://github.com/Hufe921/canvas-editor-plugin.git
cd canvas-editor-plugin && git checkout 7b630c1c8afdbf3d63f94f2ea5b9e69b2da60b04
SRC=packages/docx/src/docx
DST=/Users/apple/Documents/myf-project/eflink.tech/eflink-word/packages/word/src/core/docx
mkdir -p "$DST"
cp "$SRC/utils.ts"      "$DST/docxUtils.ts"
cp "$SRC/importDocx.ts" "$DST/importDocx.ts"
cp "$SRC/exportDocx.ts" "$DST/exportDocx.ts"
```

- [ ] **Step 2: 给三个文件头部追加版权与来源声明**

每个文件第一行前插入（保留原内容不动）：

```ts
/**
 * 收编自 @hufe921/canvas-editor-plugin-docx（MIT License）
 * 上游: https://github.com/Hufe921/canvas-editor-plugin
 * 收编版本: commit 7b630c1c8afdbf3d63f94f2ea5b9e69b2da60b04（2026-09-12）
 * 除本文件头外仅做计划列出的定点适配，保持与上游一致便于 diff。
 */
```

- [ ] **Step 3: 验证复制完整**

```bash
wc -l /Users/apple/Documents/myf-project/eflink.tech/eflink-word/packages/word/src/core/docx/*.ts
```

Expected: importDocx.ts ≈ 1859 行、exportDocx.ts ≈ 919 行、docxUtils.ts ≈ 80 行（±5 行）

- [ ] **Step 4: Commit（此时 typecheck 尚不通过，属预期，先固化上游原貌）**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git add packages/word/src/core/docx
git commit -m "chore: 收编 canvas-editor-plugin-docx 源码（verbatim，commit 7b630c1）"
```

---

### Task 3: 适配 docxUtils.ts + 纯函数单测

**Files:**
- Modify: `packages/word/src/core/docx/docxUtils.ts`
- Test: `packages/word/src/core/docx/__tests__/docxUtils.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/core/docx/__tests__/docxUtils.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { parseDocxNumber } from '../docxUtils';

describe('parseDocxNumber', () => {
  it('解析纯数字字符串', () => {
    expect(parseDocxNumber('42')).toBe(42);
  });

  it('剥离单位后缀（pt/twip 等）', () => {
    expect(parseDocxNumber('42.67pt')).toBe(42.67);
    expect(parseDocxNumber('96 twip')).toBe(96);
  });

  it('空值与非有限值返回 0', () => {
    expect(parseDocxNumber(null)).toBe(0);
    expect(parseDocxNumber(undefined)).toBe(0);
    expect(parseDocxNumber('')).toBe(0);
    expect(parseDocxNumber('abc')).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @eflink-tech/word test -- docxUtils
```

Expected: FAIL（上游 `utils.ts` 无 `export`——所有函数是非导出的）

- [ ] **Step 3: 适配 docxUtils.ts**

三处修改：

① 文件顶部 `saveAs` 改用项目已有的 file-saver（DRY，项目 `exportImport.ts` 同源），删除手写 saveAs：

```ts
// 删除这段上游实现（约 7 行）：
// export function saveAs(blob: Blob, name: string) { ... }
// 替换为：
import { saveAs } from 'file-saver';
export { saveAs };
```

② 所有函数加 `export`（上游均无 export）：`loadImage`、`parseDocxNumber`、`measureFontMetrics`、`measureTextWidth`、以及文件内其他被 importDocx/exportDocx 引用的辅助函数（若编译报“未导出”逐一补上）。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @eflink-tech/word test -- docxUtils
```

Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git add packages/word/src/core/docx/docxUtils.ts packages/word/src/core/docx/__tests__/docxUtils.test.ts
git commit -m "feat: 收编 docx 工具函数并导出，补充 parseDocxNumber 单测"
```

---

### Task 4: 适配 importDocx.ts

**Files:**
- Modify: `packages/word/src/core/docx/importDocx.ts`
- Create: `packages/word/src/core/docx/__tests__/fixtures.ts`
- Test: `packages/word/src/core/docx/__tests__/importDocx.test.ts`

- [ ] **Step 1: 写 fixtures 构造器（JSZip 现场生成最小 docx）**

创建 `src/core/docx/__tests__/fixtures.ts`：

```ts
import JSZip from 'jszip';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const STYLES = `${XML_DECL}<w:styles xmlns:w="${W_NS}"/>`;

function documentXml(body: string): string {
  return `${XML_DECL}<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;
}

/** 普通文本 run；rPrInner 为空时不输出 rPr */
function runXml(text: string, rPrInner = ''): string {
  const rPr = rPrInner ? `<w:rPr>${rPrInner}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

export function paragraphXml(text: string): string {
  return `<w:p>${runXml(text)}</w:p>`;
}

export function paragraphWithRunsXml(...runs: string[]): string {
  return `<w:p>${runs.join('')}</w:p>`;
}

export function boldRunXml(text: string): string {
  return runXml(text, '<w:b/>');
}

/** 组装最小可解析 docx，返回 ArrayBuffer */
export async function buildDocx(body: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.folder('_rels')!.file('.rels', ROOT_RELS);
  const word = zip.folder('word')!;
  word.file('document.xml', documentXml(body));
  word.file('styles.xml', STYLES);
  return zip.generateAsync({ type: 'arraybuffer' });
}
```

- [ ] **Step 2: 写失败测试**

创建 `src/core/docx/__tests__/importDocx.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { createDocxImporter } from '../importDocx';
import { boldRunXml, buildDocx, paragraphWithRunsXml, paragraphXml } from './fixtures';

/** 捕获 executeSetValue 收到的 IEditorData */
function makeMockCommand() {
  return {
    executeSetValue: vi.fn(),
    executeUpdateOptions: vi.fn(),
  };
}

describe('createDocxImporter', () => {
  let command: ReturnType<typeof makeMockCommand>;

  beforeEach(() => {
    command = makeMockCommand();
  });

  function importedData() {
    expect(command.executeSetValue).toHaveBeenCalled();
    return command.executeSetValue.mock.calls[0][0] as {
      header: unknown[];
      footer: unknown[];
      main: Array<Record<string, unknown>>;
    };
  }

  it('解析两个普通段落为 main 元素', async () => {
    const buffer = await buildDocx(
      paragraphXml('第一段') + paragraphXml('第二段'),
    );
    await createDocxImporter(command as never as Editor['command'])({
      arrayBuffer: buffer,
    });

    const data = importedData();
    expect(Array.isArray(data.main)).toBe(true);
    const text = data.main
      .map((el) => String(el.value ?? ''))
      .join('\n');
    expect(text).toContain('第一段');
    expect(text).toContain('第二段');
  });

  it('解析加粗 run 为 bold 元素', async () => {
    const buffer = await buildDocx(
      paragraphWithRunsXml(
        '<w:r><w:t>普通</w:t></w:r>' + boldRunXml('加粗'),
      ),
    );
    await createDocxImporter(command as never as Editor['command'])({
      arrayBuffer: buffer,
    });

    const data = importedData();
    const values = data.main.map((el) => ({
      value: String(el.value ?? ''),
      bold: el.bold,
    }));
    expect(values.some((el) => el.value === '加粗' && el.bold === true)).toBe(true);
    expect(values.some((el) => el.value === '普通' && !el.bold)).toBe(true);
  });

  it('缺少 word/document.xml 时抛出中文错误', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES_PLACEHOLDER);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    await expect(
      createDocxImporter(command as never as Editor['command'])({
        arrayBuffer: buffer,
      }),
    ).rejects.toThrow('docx');
  });
});

// 供上面用例引用（与 fixtures.ts 中一致的最小 Content_Types，只差 document.xml 覆盖项）
import JSZip from 'jszip';
const CONTENT_TYPES_PLACEHOLDER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`;
```

- [ ] **Step 3: 运行测试确认失败**

```bash
pnpm --filter @eflink-tech/word test -- importDocx
```

Expected: FAIL —— `createDocxImporter` 未定义（上游是 `export default function (command)`），且错误信息为英文

- [ ] **Step 4: 定点适配 importDocx.ts（共 3 处）**

① 文件尾部的默认导出工厂（上游 `export default function (command: Command) {`，约 1807 行）改名：

```ts
// 上游：
// export default function (command: Command) {
// 改为：
export function createDocxImporter(command: Command) {
```

（文件内其余内容、`declare module` 增强块保持原样；`declare module` 块因未被插件注册使用属无害冗余，暂保留以减少 diff。）

② 463 行英文报错改中文：

```ts
// 上游：
// throw new Error('invalid docx: word/document.xml not found')
// 改为：
throw new Error('无效的 docx 文件：缺少 word/document.xml，请确认为标准 .docx 格式')
```

③ 顶部 `import type Editor from '@hufe921/canvas-editor'` 若 typecheck 报未使用，删除该行（保留 `Command` 等)。

- [ ] **Step 5: 运行测试确认通过**

```bash
pnpm --filter @eflink-tech/word test -- importDocx
```

Expected: PASS（3 个用例）。若“缺少 document.xml”用例失败于错误信息不匹配，核对 ② 是否已生效；若解析用例失败于 styles.xml 缺失等，回看 fixtures 是否完整复制。

- [ ] **Step 6: Commit**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git add packages/word/src/core/docx/importDocx.ts packages/word/src/core/docx/__tests__
git commit -m "feat: 收编 docx 导入器（中文报错 + 工厂函数导出），补解析集成测试"
```

---

### Task 5: 适配 exportDocx.ts

**Files:**
- Modify: `packages/word/src/core/docx/exportDocx.ts`
- Test: `packages/word/src/core/docx/__tests__/exportDocx.test.ts`

- [ ] **Step 1: 写失败测试（round-trip：导出 → 解包断言 OOXML）**

创建 `src/core/docx/__tests__/exportDocx.test.ts`：

```ts
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { createDocxExporter } from '../exportDocx';

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
  } as unknown as Editor;
}

describe('createDocxExporter', () => {
  it('导出文本段落：解包后 document.xml 包含原文', async () => {
    const editor = makeMockEditor([{ value: '你好，世界' }]);
    const exporter = createDocxExporter(editor);
    const blob = await exporter({ fileName: '测试文档' });

    expect(blob).toBeInstanceOf(Blob);
    const zip = await JSZip.loadAsync(blob);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('你好，世界');
  });

  it('导出粗体文本：document.xml 包含 <w:b/>', async () => {
    const editor = makeMockEditor([
      { value: '加粗', bold: true, size: 16, font: 'Microsoft YaHei' },
    ]);
    const blob = await createDocxExporter(editor)({ fileName: '粗体' });
    const zip = await JSZip.loadAsync(blob);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:b/>');
  });

  it('不触发浏览器下载（下载职责上移到入口层）', async () => {
    const editor = makeMockEditor([{ value: 'x' }]);
    const anchorSpy = vi.spyOn(document.body, 'append');
    await createDocxExporter(editor)({ fileName: '不下载' });
    expect(anchorSpy).not.toHaveBeenCalled();
    anchorSpy.mockRestore();
  });
});
```

（测试文件顶部需补 `import { vi } from 'vitest'`——并入第一行 import。）

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @eflink-tech/word test -- exportDocx
```

Expected: FAIL —— `createDocxExporter` 未定义（上游为 `export default function (editor)`），且上游直接调用 saveAs 触发下载

- [ ] **Step 3: 定点适配 exportDocx.ts（共 4 处）**

① 尾部默认导出工厂改名（约 794 行）：

```ts
// 上游：export default function (editor: Editor) {
// 改为：
export function createDocxExporter(editor: Editor) {
```

② 去掉函数内部的下载调用——下载职责上移到入口层（Task 6）。找到（约 917 行）：

```ts
// 上游：
// const blob = await Packer.toBlob(doc)
// saveAs(blob, `${fileName}.docx`)
// return blob
// 改为：
const blob = await Packer.toBlob(doc)
return blob
```

同时删除顶部来自 `./utils` 的 `saveAs` import（保留 `loadImage`、`measureFontMetrics`、`measureTextWidth`）。

③ 若 typecheck 报 docx@9 与上游 v8 API 的类型差异，仅做最小类型适配。已知上游源码已使用 v9 的 `ImageRun({ type, ... })` 写法（`inferImageType` 已返回 `'jpg' | 'png' | 'gif' | 'bmp'`），理论上无需改动；若有零星类型报错，按报错信息最小修复并在此处记录每处改动。

④ `declare module` 增强块保持原样（同 Task 4 原则）。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @eflink-tech/word test -- exportDocx
```

Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git add packages/word/src/core/docx/exportDocx.ts packages/word/src/core/docx/__tests__/exportDocx.test.ts
git commit -m "feat: 收编 docx 导出器（工厂函数导出 + 下载职责上移），补 round-trip 测试"
```

---

### Task 6: 统一入口 index.ts（.doc 拦截 + 动态加载）

**Files:**
- Create: `packages/word/src/core/docx/index.ts`
- Test: `packages/word/src/core/docx/__tests__/docxIO.test.ts`

- [ ] **Step 1: 写失败测试（TDD：.doc 拦截 + 文件名清洗）**

创建 `src/core/docx/__tests__/docxIO.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { exportDocx, importDocx } from '../index';

const fakeEditor = {} as Editor;

/** 构造 File（node20/jsdom 均可用） */
function makeFile(content: Uint8Array | ArrayBuffer, name: string): File {
  return new File([content as BlobPart], name);
}

describe('importDocx 入口拦截', () => {
  it('OLE2 魔数（旧版 .doc）直接拒绝，且不触碰编辑器', async () => {
    const ole = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0,
    ]);
    const setValue = vi.fn();
    const editor = { command: { executeSetValue: setValue } } as unknown as Editor;
    await expect(
      importDocx(editor, makeFile(ole, '伪装.docx')),
    ).rejects.toThrow('.doc');
    expect(setValue).not.toHaveBeenCalled();
  });

  it('.doc 扩展名直接拒绝', async () => {
    await expect(
      importDocx(fakeEditor, makeFile(new Uint8Array(8), '报告.doc')),
    ).rejects.toThrow('.doc');
  });
});

describe('exportDocx 文件名处理', () => {
  it('非法字符被清洗为下划线', async () => {
    // 不真实导出：仅校验 exportDocx 对文件名的清洗由 sanitizeExportBasename 承担
    // （真实导出链路在 exportDocx.test.ts 已覆盖，这里只验证入口不抛文件名异常）
    const editor = makeMockEditorForExport([{ value: '内容' }]);
    await expect(
      exportDocx(editor, '非法/文件:名*.docx'),
    ).resolves.toBeUndefined();
  });
});

function makeMockEditorForExport(main: Array<Record<string, unknown>>): Editor {
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
  } as unknown as Editor;
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @eflink-tech/word test -- docxIO
```

Expected: FAIL —— `../index` 不存在

- [ ] **Step 3: 实现入口**

创建 `src/core/docx/index.ts`：

```ts
// docx 导入导出统一入口
// - 动态 import 收编模块：docx / jszip 进入独立 chunk，不进组件库主包
// - 旧版 .doc（OLE2 复合文档）在入口层拦截，给出中文引导
import { saveAs } from 'file-saver';
import type Editor from '@hufe921/canvas-editor';
import { sanitizeExportBasename } from '../utils/exportImport';

/** OLE2（CFB 复合文档）魔数，即旧版 .doc / .xls / .ppt 的文件头 */
const OLE_SIGNATURE: readonly number[] = [
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
];

function isLegacyDocBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 8) {
    return false;
  }
  const head = new Uint8Array(buffer, 0, 8);
  return OLE_SIGNATURE.every((byte, index) => head[index] === byte);
}

function assertNotLegacyDoc(file: File, buffer: ArrayBuffer): void {
  const looksLegacyByName = /\.doc$/i.test(file.name);
  if (looksLegacyByName || isLegacyDocBuffer(buffer)) {
    throw new Error('暂不支持旧版 .doc 格式，请用 Word/WPS 另存为 .docx 后重试');
  }
}

/**
 * 导入 docx：解析并覆盖当前文档内容
 * @throws 旧版 .doc 格式、非标准 docx 结构时抛出中文错误
 */
export async function importDocx(editor: Editor, file: File): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  assertNotLegacyDoc(file, arrayBuffer);
  const { createDocxImporter } = await import('./importDocx');
  createDocxImporter(editor.command)({ arrayBuffer });
}

/** 导出 docx 并触发浏览器下载 */
export async function exportDocx(editor: Editor, filename = '未命名文档'): Promise<void> {
  const title = sanitizeExportBasename(filename);
  const { createDocxExporter } = await import('./exportDocx');
  const blob = await createDocxExporter(editor)({ fileName: title });
  saveAs(blob, `${title}.docx`);
}
```

注意：**不要**在包入口 `src/index.ts` 里 re-export 这些函数——那会把 docx/jszip 拉进主 bundle，破坏分包（设计文档的动态加载要求）。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @eflink-tech/word test -- docxIO
```

Expected: PASS（3 个用例）

- [ ] **Step 5: 全量回归（docx 目录所有测试）**

```bash
pnpm --filter @eflink-tech/word test -- core/docx
```

Expected: 全部 PASS（docxUtils 3 + importDocx 3 + exportDocx 3 + docxIO 3）

- [ ] **Step 6: Commit**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git add packages/word/src/core/docx/index.ts packages/word/src/core/docx/__tests__/docxIO.test.ts
git commit -m "feat: docx 导入导出统一入口（旧版 .doc 拦截 + 动态分包加载）"
```

---

### Task 7: 错误弹窗 ErrorDialog

**Files:**
- Create: `packages/word/src/components/common/ErrorDialog.tsx`

- [ ] **Step 1: 实现组件（仿 ConfirmDialog 的样式与 Escape 处理）**

创建 `src/components/common/ErrorDialog.tsx`：

```tsx
import { useEffect } from 'react';

interface ErrorDialogProps {
  title: string;
  message: string;
  onClose: () => void;
}

/** 操作失败提示弹窗（docx 导入导出等场景） */
export function ErrorDialog({ title, message, onClose }: ErrorDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-[420px] rounded-md border border-[#e7e9eb] bg-white p-5 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-[15px] font-medium text-[#1f2329]">{title}</div>
        <div className="mb-4 text-[13px] leading-5 text-[#646a73] break-words">{message}</div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git add packages/word/src/components/common/ErrorDialog.tsx
git commit -m "feat: 新增通用错误弹窗 ErrorDialog"
```

---

### Task 8: ToolbarMenu 接入

**Files:**
- Modify: `packages/word/src/components/toolbar/ToolbarMenu.tsx`

- [ ] **Step 1: 增加 import（lucide 图标区补 `FileInput`、`FileOutput`，均已在包内验证存在；组件区补 ErrorDialog）**

```tsx
// lucide import 块（第 6-37 行）内按字母序插入：
//   FileInput,
//   FileOutput,
// 组件 import 区（第 40 行附近）新增：
import { ErrorDialog } from '../common/ErrorDialog';
```

- [ ] **Step 2: 新增状态与 refs（第 105-108 行现有 state 区之后）**

```tsx
const [docxExporting, setDocxExporting] = useState(false);
const [docxImporting, setDocxImporting] = useState(false);
const [docxError, setDocxError] = useState<string | null>(null);
const docxImportInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: 新增处理函数（插在 `exportImageFile` 之后、`triggerImport` 之前，约 224 行）**

```tsx
// 导出 Word：动态加载 docx 模块（docx/jszip 独立 chunk，不进主包），失败弹错误窗
const exportDocxFile = async () => {
  if (!editor || docxExporting) return;
  closeAll();
  flushSync(() => setDocxExporting(true));
  try {
    const { exportDocx } = await import('../../core/docx');
    await exportDocx(editor, getDocTitle());
  } catch (err) {
    setDocxError(err instanceof Error ? err.message : '导出 Word 失败，请重试');
  } finally {
    setDocxExporting(false);
  }
};

const triggerDocxImport = () => {
  closeAll();
  if (docxImportInputRef.current) {
    docxImportInputRef.current.value = '';
    docxImportInputRef.current.click();
  }
};

// 导入 Word：解析后覆盖当前文档（与 .efword 导入一致），失败弹错误窗
const handleDocxImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !editor) return;
  flushSync(() => setDocxImporting(true));
  try {
    const { importDocx } = await import('../../core/docx');
    await importDocx(editor, file);
  } catch (err) {
    setDocxError(err instanceof Error ? err.message : '导入 Word 失败，请重试');
  } finally {
    setDocxImporting(false);
    if (docxImportInputRef.current) docxImportInputRef.current.value = '';
  }
};
```

- [ ] **Step 4: 文件菜单 categories 注册菜单项**

① 「文件」组导出区（现 `export-efword` 项之前，约 277 行）插入：

```tsx
{
  key: 'export-docx',
  label: '导出 Word (.docx)',
  icon: FileOutput,
  action: exportDocxFile,
},
```

② 导入区（现 `import` 项之后，约 299 行）插入：

```tsx
{
  key: 'import-docx',
  label: '导入 Word (.docx)',
  icon: FileInput,
  action: triggerDocxImport,
},
```

- [ ] **Step 5: 底部 JSX 追加（约 606 行现有隐藏 file input 之后）**

```tsx
<input
  ref={docxImportInputRef}
  type="file"
  accept=".docx"
  className="hidden"
  onChange={handleDocxImportChange}
/>
```

以及 LoadingDialog / ErrorDialog 区（约 638-639 行现有两个 LoadingDialog 之后）：

```tsx
{docxExporting && <LoadingDialog message="正在导出 Word，请稍候..." />}
{docxImporting && <LoadingDialog message="正在导入 Word，请稍候..." />}
{docxError && (
  <ErrorDialog
    title="操作失败"
    message={docxError}
    onClose={() => setDocxError(null)}
  />
)}
```

- [ ] **Step 6: typecheck + lint + 全量测试**

```bash
pnpm --filter @eflink-tech/word typecheck
pnpm --filter @eflink-tech/word lint
pnpm --filter @eflink-tech/word test
```

Expected: 三项全部通过，无回归失败

- [ ] **Step 7: Commit**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git add packages/word/src/components/toolbar/ToolbarMenu.tsx
git commit -m "feat: 文件菜单接入 docx 导入导出（loading 遮罩 + 错误弹窗）"
```

---

### Task 9: 构建验证（分包）+ changeset

**Files:**
- Create: `.changeset/docx-import-export.md`（在 `eflink-word/` 仓库根）

- [ ] **Step 1: 构建 library 并核对 chunk 划分**

```bash
pnpm --filter @eflink-tech/word build
```

Expected: 构建成功；dist 中 docx 相关代码（docx 库、jszip）位于独立异步 chunk（构建日志可见多个 .js 产物），主入口 `index.js` 体积不应因 docx 库显著膨胀（主入口增量 < 10KB 为合格）。

- [ ] **Step 2: 新增 changeset**

创建 `eflink-word/.changeset/docx-import-export.md`：

```md
---
'@eflink-tech/word': minor
---

文件菜单新增 Word (.docx) 导入与导出：可打开常规办公 docx 文档（段落样式/标题/列表/表格/图片/页眉页脚），亦可导出为 .docx。旧版 .doc 格式不受支持并给出中文提示。docx 能力按需加载，不影响组件库主包体积。
```

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git add .changeset/docx-import-export.md
git commit -m "chore: docx 导入导出 changeset（minor）"
```

（dist 为构建产物，不入库。）

---

### Task 10: Demo 手动验收

**Files:** 无代码改动（验证任务）

- [ ] **Step 1: 启动 demo**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
pnpm dev:demo
```

（demo 端口以终端输出为准，浏览器打开编辑器页面。）

- [ ] **Step 2: 真实文档验收清单**

准备 3 份真实 Word 文档：①简单合同（段落+标题+粗体）②带表格的报告 ③带页眉页脚+图片的通知。逐项验证：

- [ ] 「文件 → 导入 Word (.docx)」打开 ①，段落/标题/粗体正确还原，页面尺寸与 Word 一致
- [ ] 打开 ②，表格边框/合并/文字位置正确
- [ ] 打开 ③，页眉页脚内容与图片位置正确
- [ ] 「文件 → 导出 Word (.docx)」下载后用 Word/WPS 打开：内容、样式、表格、页眉页脚可读且与画布一致
- [ ] 导入→导出 round-trip：同一份 docx 导入后直接导出，两次打开的 Word 文档版式基本一致
- [ ] 把某 .doc 文件改名为 .docx 后导入 → 弹「暂不支持旧版 .doc 格式…」错误窗
- [ ] 导入损坏文件（如改后缀的图片）→ 弹错误窗，编辑器内容不受影响
- [ ] 导入/导出过程中 loading 遮罩出现且结束后消失
- [ ] 刷新页面确认导入覆盖的内容可自动保存（IndexedDB）

- [ ] **Step 3: 验收通过后提交最终状态**

```bash
cd /Users/apple/Documents/myf-project/eflink.tech/eflink-word
git status --short   # 确认无遗漏文件
```

如验收发现问题：修复 → 重跑 `pnpm --filter @eflink-tech/word test` → `fix: <问题描述>` 提交。

---

## 收编豁免说明

`importDocx.ts`（约 1859 行）与 `exportDocx.ts`（约 919 行）为上游 verbatim 收编，超过用户编码规范 800 行上限与「不复制粘贴」原则属有意豁免：保持与上游逐行可 diff，将来同步上游修复或回贡 patch 成本最低。后续如需深度改造，再行拆分。

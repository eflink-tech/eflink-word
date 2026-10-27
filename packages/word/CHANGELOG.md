# @eflink-tech/word

## 0.2.0

### Minor Changes

- f6509df: 文件菜单新增 Word (.docx) 导入与导出：可打开常规办公 docx 文档（段落样式/标题/列表/表格/图片/页眉页脚），亦可导出为 .docx。旧版 .doc 格式不受支持并给出中文提示。docx 能力按需加载，不影响组件库主包体积。

## 0.1.1

### Patch Changes

- 修复查找替换不生效：StrictMode 下 mountedRef 失效导致全部替换无效、结果计数不更新；单处替换改为精确替换当前匹配；修正结果计数 off-by-one。

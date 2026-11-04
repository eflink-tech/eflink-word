# @eflink-tech/word

## 0.1.2

### Patch Changes

- 修复 docx 导入页眉/页脚丢失：无 separate 的页脚 PAGE/NUMPAGES 域（Gemini/WPS 导出常见）按指令解析并换算 pageNumber 模板，页码字号/颜色跟随域 run 样式；页眉/页脚距边距离改读 sectPr > pgMar 的 w:header/w:footer 属性（原找不存在的子元素恒取不到）；导入返回 hasHeader/hasFooter/pageNumber，菜单导入完成后同步进应用页眉/页脚/页码显示配置，不再被默认配置重放覆盖（源文档无页码域时不再显示默认"第N页/共N页"）。

## 0.1.1

### Patch Changes

- 修复查找替换不生效：StrictMode 下 mountedRef 失效导致全部替换无效、结果计数不更新；单处替换改为精确替换当前匹配；修正结果计数 off-by-one。

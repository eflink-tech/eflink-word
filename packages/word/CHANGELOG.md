# @eflink-tech/word

## 0.1.1

### Patch Changes

- 修复查找替换不生效：StrictMode 下 mountedRef 失效导致全部替换无效、结果计数不更新；单处替换改为精确替换当前匹配；修正结果计数 off-by-one。

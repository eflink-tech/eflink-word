# @eflink-tech/word

开箱即用的在线 Word 文档编辑器 React 组件（基于 [canvas-editor](https://github.com/Hufe921/canvas-editor)）。可独立运行，也可作为组件嵌入任意 React 应用。

## 安装

```bash
npm install @eflink-tech/word
# react / react-dom >= 18 为 peer 依赖
```

## 使用

```tsx
import { WordEditor } from '@eflink-tech/word';
import '@eflink-tech/word/styles.css';

<div style={{ height: '100vh' }}>
  <WordEditor docId={docId} branding={{ logo: '/logo.png', name: '我的文档' }} />
</div>
```

存储可插拔（默认 IndexedDB，可注入 `StorageAdapter` 对接后端）；导出 `createWordDocument / exportEfword / importEfword / exportPdf` 等 headless API、三个 zustand store 与全部数据类型。

完整文档（props、存储适配器、本地开发）见仓库根 README：

https://github.com/eflink-tech/eflink-word

## License

MIT

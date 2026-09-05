import { useEffect, useRef, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { WordEditor, useDocumentStore } from '@eflink-tech/word';

/**
 * /edit/:id 路由 → 解析目标文档后渲染 WordEditor。
 * 路由是独立应用（demo）的职责：库组件只接收 docId，不感知 URL。
 */
function EditorRoute() {
  const { id: routeDocId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [docId, setDocId] = useState<string | null>(null);
  // 记录已处理的路由 id：防止 StrictMode 双执行导致重复建档
  const handled = useRef<{ id?: string; done: boolean }>({ id: undefined, done: false });

  useEffect(() => {
    const idKey = routeDocId ?? undefined;
    if (handled.current.done && handled.current.id === idKey) return;
    handled.current = { id: idKey, done: true };
    void (async () => {
      const { loadDocuments, createDocument } = useDocumentStore.getState();
      const docs = await loadDocuments();
      // 有路由 id → 打开指定文档；无 id → 打开最近编辑的文档
      const target = routeDocId ? docs.find((d) => d.id === routeDocId) : docs[0];
      if (target) {
        setDocId(target.id);
        return;
      }
      // 路由文档不存在（如已删除）或本地还没有文档：新建一篇并进入
      const newId = await createDocument('未命名文档');
      setDocId(newId);
      navigate(`/edit/${newId}`, { replace: true });
    })();
  }, [routeDocId, navigate]);

  if (!docId) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f5f6f7] text-sm text-[#8f959e]">
        正在加载文档...
      </div>
    );
  }

  return (
    <WordEditor
      docId={docId}
      branding={{ logo: '/logo.png', name: '易飞文档' }}
      guardUnload
      onDocIdChange={(id) => navigate(`/edit/${id}`)}
    />
  );
}

// 无列表页：任何路由直接进入编辑器；"/" 打开最近编辑的文档
function App() {
  return (
    <Routes>
      <Route path="/" element={<EditorRoute />} />
      <Route path="/edit" element={<EditorRoute />} />
      <Route path="/edit/:id" element={<EditorRoute />} />
      <Route path="*" element={<EditorRoute />} />
    </Routes>
  );
}

export default App;

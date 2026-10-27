import { useEffect, useRef, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  WordEditor,
  useDocumentStore,
  builtinEditorBrand,
  resolveEditorBrandId,
  type EditorBrandId,
  type WordLocale,
} from '@eflink-tech/word';

const LOCALES: { value: WordLocale; label: string }[] = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'pt-BR', label: 'Português' },
];

const BRANDS: { value: EditorBrandId; label: string }[] = [
  { value: 'doculuma', label: 'DocuLuma' },
  { value: 'eflink', label: 'Eflink' },
];

const UNTITLED: Record<WordLocale, string> = {
  'zh-CN': '未命名文档',
  en: 'Untitled document',
  es: 'Documento sin título',
  'pt-BR': 'Documento sem título',
};

function readLocale(): WordLocale {
  const value = new URLSearchParams(window.location.search).get('locale');
  return LOCALES.find((item) => item.value === value)?.value ?? 'zh-CN';
}

/** ?brand=eflink 直达指定品牌，便于逐品牌验收 */
function readBrand(): EditorBrandId {
  return resolveEditorBrandId(new URLSearchParams(window.location.search).get('brand'));
}

function LanguageSwitcher({
  locale,
  onChange,
}: {
  locale: WordLocale;
  onChange: (locale: WordLocale) => void;
}) {
  return (
    <select
      value={locale}
      onChange={(e) => onChange(e.target.value as WordLocale)}
      aria-label="Language"
      className="fixed bottom-9 right-3 z-[100000] rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-[#1f2329] shadow-md outline-none"
    >
      {LOCALES.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

/**
 * /edit/:id 路由 → 解析目标文档后渲染 WordEditor。
 * 路由是独立应用（demo）的职责：库组件只接收 docId，不感知 URL。
 */
function EditorRoute({
  locale,
  brand,
  onLocaleChange,
  onBrandChange,
}: {
  locale: WordLocale;
  brand: EditorBrandId;
  onLocaleChange: (locale: WordLocale) => void;
  onBrandChange: (brand: EditorBrandId) => void;
}) {
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
      const newId = await createDocument(UNTITLED[locale]);
      setDocId(newId);
      navigate(`/edit/${newId}?locale=${locale}`, { replace: true });
    })();
  }, [routeDocId, navigate, locale]);

  if (!docId) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f5f6f7] text-sm text-[#8f959e]">
        {locale === 'zh-CN'
          ? '正在加载文档...'
          : locale === 'es'
            ? 'Cargando documento…'
            : locale === 'pt-BR'
              ? 'Carregando documento…'
              : 'Loading document…'}
      </div>
    );
  }

  return (
    <>
      <WordEditor
        docId={docId}
        locale={locale}
        branding={brand}
        guardUnload
        onDocIdChange={(id) => navigate(`/edit/${id}?locale=${locale}`)}
      />
      <select
        value={brand}
        aria-label="Brand"
        onChange={(e) => onBrandChange(e.target.value as EditorBrandId)}
        className="fixed bottom-3 right-3 z-[100000] rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-[#1f2329] shadow-md outline-none"
      >
        {BRANDS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
    </>
  );
}

// 无列表页：任何路由直接进入编辑器；"/" 打开最近编辑的文档
function App() {
  const [locale, setLocale] = useState<WordLocale>(readLocale);
  const [brand, setBrand] = useState<EditorBrandId>(readBrand);

  const handleLocaleChange = (next: WordLocale) => {
    const url = new URL(window.location.href);
    url.searchParams.set('locale', next);
    window.history.replaceState(null, '', url);
    setLocale(next);
  };

  const handleBrandChange = (next: EditorBrandId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('brand', next);
    window.history.replaceState(null, '', url);
    setBrand(next);
  };

  useEffect(() => {
    document.title = builtinEditorBrand(brand).name;
  }, [brand]);

  const routeProps = { locale, brand, onLocaleChange: handleLocaleChange, onBrandChange: handleBrandChange };

  return (
    <Routes>
      <Route path="/" element={<EditorRoute {...routeProps} />} />
      <Route path="/edit" element={<EditorRoute {...routeProps} />} />
      <Route path="/edit/:id" element={<EditorRoute {...routeProps} />} />
      <Route path="*" element={<EditorRoute {...routeProps} />} />
    </Routes>
  );
}

export default App;

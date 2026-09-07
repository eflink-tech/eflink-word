// AI 助手面板：设置 / 对话（携带文档上下文）/ 生成文档 / 选区快捷操作 / 会话历史
// 交互模式与 eflink-pptx 的 AIChatPanel 保持一致
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, FileDown, History, Send, Settings, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { aiDb, aiSettingsStore, BUILTIN_TEMPLATES } from '../../ai/db';
import { errorMessage, sendMessage, type ChatMessage } from '../../ai/aiService';
import { buildDocPrompt, buildTextPrompt, parseAIDocument } from '../../ai/systemPrompt';
import {
  getDocumentText,
  getSelectedText,
  insertAIDocument,
  replaceSelectionWithText,
} from '../../ai/actionExecutor';
import type { AIDocument, AISettings, Conversation } from '../../ai/types';

type PanelView = 'chat' | 'settings' | 'history';

interface SimpleMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ACCENT = '#3370ff';

export function AIChatPanel() {
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel);
  const [view, setView] = useState<PanelView>('chat');
  const [settings, setSettings] = useState<AISettings>({ baseUrl: '', apiKey: '', model: '' });
  const [configured, setConfigured] = useState(false);
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [genView, setGenView] = useState(false);
  const [topic, setTopic] = useState('');
  const [requirements, setRequirements] = useState('');
  const [pendingDoc, setPendingDoc] = useState<AIDocument | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<Conversation[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void aiSettingsStore.getSettings().then((s) => {
      setSettings(s);
      setConfigured(Boolean(s.baseUrl && s.apiKey && s.model));
    });
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  // 会话持久化：消息变化时写入 Dexie
  useEffect(() => {
    if (!messages.length) return;
    const id = convId ?? (() => { const nid = `conv-${Date.now()}`; setConvId(nid); return nid; })();
    const now = Date.now();
    void aiDb.conversations.put({
      id,
      title: messages[0]?.content.replace(/\n/g, ' ').slice(0, 24) || '新对话',
      messages: messages.map((m) => ({ ...m, time: now })),
      createdAt: now,
      updatedAt: now,
    });
  }, [messages, convId]);

  const loadHistory = () => {
    void aiDb.conversations.orderBy('updatedAt').reverse().toArray().then(setHistoryList);
  };

  const openConversation = (conv: Conversation) => {
    setMessages(conv.messages.map((m) => ({ role: m.role, content: m.content })));
    setConvId(conv.id);
    setView('chat');
  };

  const deleteConversation = (id: string) => {
    void aiDb.conversations.delete(id).then(loadHistory);
  };

  const saveSettings = () => {
    void aiSettingsStore.saveSettings(settings).then(() => {
      setConfigured(Boolean(settings.baseUrl && settings.apiKey && settings.model));
      setView('chat');
    });
  };

  const buildSystemPrompt = (): string => {
    const docText = getDocumentText();
    return [
      '你是易飞文档的 AI 写作助手，回答简洁专业，用中文。',
      docText ? `当前文档内容如下（供参考）：\n${docText}` : '当前文档为空。',
    ].join('\n');
  };

  const doSend = async (userText: string, onText?: (text: string) => string) => {
    if (busy) return;
    const s = await aiSettingsStore.getSettings();
    if (!s.baseUrl || !s.apiKey || !s.model) {
      setView('settings');
      return;
    }
    const text = onText ? onText(userText) : userText;
    const next: SimpleMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const chat: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...next.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    ];

    try {
      await sendMessage({
        settings: s,
        messages: chat,
        signal: controller.signal,
        onContentChunk: (_chunk, full) => {
          setMessages([...next, { role: 'assistant', content: full }]);
        },
      });
    } catch (error) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${errorMessage(error)}` }]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  /** 生成整篇文档（结构化 JSON），结果先展示摘要，由用户确认后插入文档 */
  const generateDoc = () => {
    if (busy) return;
    if (!topic.trim()) return;
    void (async () => {
      const s = await aiSettingsStore.getSettings();
      if (!s.baseUrl || !s.apiKey || !s.model) {
        setView('settings');
        return;
      }
      setBusy(true);
      setPendingDoc(null);
      const label = `生成文档：${topic.trim()}`;
      const next: SimpleMessage[] = [...messages, { role: 'user', content: label }];
      setMessages(next);
      try {
        const { content } = await sendMessage({
          settings: s,
          messages: [
            { role: 'system', content: '你是专业的文档撰写专家，只输出 JSON。' },
            { role: 'user', content: buildDocPrompt(topic.trim(), requirements.trim()) },
          ],
          onContentChunk: (_c, full) => {
            setMessages([...next, { role: 'assistant', content: `正在生成…（${full.length} 字）` }]);
          },
        });
        const doc = parseAIDocument(content);
        setPendingDoc(doc);
        const outline = doc.elements
          .filter((e) => e.type === 'title')
          .map((e) => `${'  '.repeat(Math.max(0, (e.level ?? 1) - 1))}· ${e.text}`)
          .slice(0, 12);
        setMessages([
          ...next,
          {
            role: 'assistant',
            content: `已生成《${doc.title ?? topic.trim()}》：${doc.elements.length} 个内容块。\n${outline.join('\n')}`,
          },
        ]);
      } catch (error) {
        setMessages([...next, { role: 'assistant', content: `⚠️ ${errorMessage(error)}` }]);
      } finally {
        setBusy(false);
      }
    })();
  };

  const insertPendingDoc = () => {
    if (!pendingDoc) return;
    try {
      insertAIDocument(pendingDoc);
      setPendingDoc(null);
      setGenView(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: '已插入文档。可撤销（Ctrl+Z）回退。' }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${error instanceof Error ? error.message : '插入失败'}` }]);
    }
  };

  /** 选区快捷操作：润色/扩写/续写/翻译/总结，结果替换选区 */
  const runTemplate = (templateId: string) => {
    const selected = getSelectedText();
    if (!selected.trim()) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ 请先在文档中选中要处理的文本' }]);
      return;
    }
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    void doSend(selected, (text) => buildTextPrompt(tpl.content, text, ''));
  };

  // 自由对话的最后结果：有选区时提供「替换选区」操作
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.content.startsWith('⚠️'));
  const canApplyToSelection = Boolean(lastAssistant) && !busy && Boolean(getSelectedText().trim());

  const applyLastToSelection = () => {
    if (!lastAssistant) return;
    try {
      replaceSelectionWithText(lastAssistant.content);
      setMessages((prev) => [...prev, { role: 'assistant', content: '已替换选中内容。' }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${error instanceof Error ? error.message : '替换失败'}` }]);
    }
  };

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-black/[0.08] bg-white" data-testid="ai-panel">
      {/* 头部 */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/[0.06] px-3">
        <span className="flex items-center gap-1 text-sm font-medium text-[#1f2329]">
          <Sparkles size={15} style={{ color: ACCENT }} />
          AI 助手
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="rounded p-1 text-[#8f959e] transition-colors hover:bg-black/[0.06] hover:text-[#1f2329]"
            title="会话历史"
            onClick={() => { loadHistory(); setView(view === 'history' ? 'chat' : 'history'); }}
          >
            <History size={15} />
          </button>
          <button
            type="button"
            className="rounded p-1 text-[#8f959e] transition-colors hover:bg-black/[0.06] hover:text-[#1f2329]"
            title="AI 设置"
            onClick={() => setView(view === 'settings' ? 'chat' : 'settings')}
          >
            <Settings size={15} />
          </button>
          <button
            type="button"
            className="rounded p-1 text-[#8f959e] transition-colors hover:bg-black/[0.06] hover:text-[#1f2329]"
            title="新对话"
            onClick={() => { setMessages([]); setPendingDoc(null); setConvId(null); setView('chat'); }}
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className="rounded p-1 text-[#8f959e] transition-colors hover:bg-black/[0.06] hover:text-[#1f2329]"
            title="收起"
            onClick={toggleAIPanel}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <div className="flex-1 overflow-y-auto p-3" data-testid="ai-history">
          <button
            type="button"
            className="mb-2 flex items-center gap-1 text-xs text-[#646a73] hover:text-[#1f2329]"
            onClick={() => setView('chat')}
          >
            <ChevronLeft size={14} />
            返回对话
          </button>
          {historyList.length === 0 && <div className="py-6 text-center text-xs text-[#8f959e]">暂无历史会话</div>}
          <div className="space-y-1.5">
            {historyList.map((conv) => (
              <div key={conv.id} className="flex items-center gap-2 rounded-lg border border-black/[0.08] px-3 py-2">
                <button
                  type="button"
                  className="flex-1 truncate text-left text-xs text-[#1f2329]"
                  onClick={() => openConversation(conv)}
                >
                  {conv.title}
                </button>
                <span className="shrink-0 text-[10px] text-[#8f959e]">
                  {new Date(conv.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-[#8f959e] hover:bg-red-50 hover:text-red-500"
                  title="删除"
                  onClick={() => deleteConversation(conv.id)}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : view === 'settings' ? (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 text-xs leading-relaxed text-[#646a73]">
            配置任意 OpenAI 兼容接口（如通义千问、DeepSeek、Kimi）。密钥仅保存在本地浏览器（IndexedDB），不会上传。
          </div>
          {([
            ['baseUrl', '接口地址', 'https://dashscope.aliyuncs.com/compatible-mode/v1'],
            ['apiKey', 'API Key', 'sk-…'],
            ['model', '模型', 'qwen-plus'],
          ] as const).map(([key, label, placeholder]) => (
            <div key={key} className="mb-2">
              <div className="mb-1 text-xs text-[#646a73]">{label}</div>
              <input
                type={key === 'apiKey' ? 'password' : 'text'}
                value={settings[key]}
                placeholder={placeholder}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                className="w-full rounded border border-black/[0.12] px-2 py-1.5 text-xs outline-none focus:border-[#3370ff]"
              />
            </div>
          ))}
          <button
            type="button"
            className="mt-2 w-full rounded-md py-1.5 text-xs text-white"
            style={{ backgroundColor: ACCENT }}
            onClick={saveSettings}
          >
            保存设置
          </button>
        </div>
      ) : (
        <>
          {/* 生成文档流程 */}
          <div className="shrink-0 border-b border-black/[0.06] p-2">
            {!genView ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs"
                style={{ backgroundColor: '#eaf1ff', color: ACCENT }}
                onClick={() => setGenView(true)}
                data-testid="ai-gen-toggle"
              >
                <Wand2 size={14} />
                AI 写文档
              </button>
            ) : (
              <div className="rounded-md bg-[#f5f6f7] p-2">
                <div className="mb-1.5 flex items-center justify-between text-xs text-[#646a73]">
                  <span>生成文档</span>
                  <button type="button" className="text-[#8f959e] hover:text-[#1f2329]" onClick={() => setGenView(false)}>收起</button>
                </div>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="输入主题，如：项目复盘报告"
                  className="mb-1.5 w-full rounded border border-black/[0.12] px-2 py-1.5 text-xs outline-none focus:border-[#3370ff]"
                  data-testid="ai-gen-topic"
                />
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="补充要求（可选）：字数、风格、受众…"
                  rows={2}
                  className="mb-1.5 w-full resize-none rounded border border-black/[0.12] px-2 py-1.5 text-xs outline-none focus:border-[#3370ff]"
                />
                <button
                  type="button"
                  className="w-full rounded-md py-1.5 text-xs text-white disabled:opacity-50"
                  style={{ backgroundColor: ACCENT }}
                  disabled={busy || !topic.trim()}
                  onClick={generateDoc}
                  data-testid="ai-gen-doc"
                >
                  {busy ? '生成中…' : '生成'}
                </button>
                {pendingDoc && (
                  <button
                    type="button"
                    className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-xs"
                    style={{ borderColor: ACCENT, color: ACCENT }}
                    onClick={insertPendingDoc}
                    data-testid="ai-insert-doc"
                  >
                    <FileDown size={13} />
                    插入到文档
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 消息列表 */}
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3" data-testid="ai-messages">
            {!configured && (
              <div className="rounded-md bg-[#eaf1ff] p-2 text-xs text-[#1f2329]">
                尚未配置 AI 接口，点击右上角 ⚙️ 进行设置。
              </div>
            )}
            {configured && messages.length === 0 && (
              <div className="rounded-md bg-[#f5f6f7] p-2.5 text-xs leading-relaxed text-[#646a73]">
                你可以让我：撰写/润色文本、总结全文、翻译选区、生成表格……选中文档内容后可用下方快捷操作。
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap rounded-md px-2.5 py-2 text-xs leading-relaxed ${
                  m.role === 'user' ? 'ml-6 text-white' : 'mr-2 bg-[#f5f6f7] text-[#1f2329]'
                }`}
                style={m.role === 'user' ? { backgroundColor: ACCENT } : undefined}
              >
                {m.content}
              </div>
            ))}
            {canApplyToSelection && (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-xs"
                style={{ borderColor: ACCENT, color: ACCENT }}
                onClick={applyLastToSelection}
              >
                <FileDown size={13} />
                用最新结果替换选中内容
              </button>
            )}
          </div>

          {/* 选区快捷操作 */}
          <div className="flex shrink-0 flex-wrap gap-1 border-t border-black/[0.06] px-2 pt-2">
            {BUILTIN_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="rounded-full border border-black/[0.12] px-2 py-0.5 text-[11px] text-[#646a73] hover:border-[#3370ff] hover:text-[#3370ff] disabled:opacity-50"
                disabled={busy}
                onClick={() => runTemplate(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* 输入区 */}
          <div className="flex shrink-0 items-end gap-1.5 p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) void doSend(input.trim());
                }
              }}
              rows={2}
              placeholder="输入消息，Enter 发送"
              className="flex-1 resize-none rounded-md border border-black/[0.12] px-2 py-1.5 text-xs outline-none focus:border-[#3370ff]"
              data-testid="ai-input"
            />
            {busy ? (
              <button
                type="button"
                className="rounded-md bg-black/[0.08] px-3 py-2 text-xs text-[#1f2329]"
                onClick={() => abortRef.current?.abort()}
              >
                停止
              </button>
            ) : (
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-white disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
                disabled={!input.trim()}
                onClick={() => input.trim() && void doSend(input.trim())}
                aria-label="发送"
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

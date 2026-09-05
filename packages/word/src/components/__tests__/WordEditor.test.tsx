import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { WordEditor } from '../WordEditor';
import { useDocumentStore } from '../../store/documentStore';
import { getDefaultStorage, setDefaultStorage } from '../../storage/registry';
import { memoryStorage } from '../../storage/memory';
import { createWordDocument } from '../../types/document';
import { mockCommand, mockEventBus, mockOverride } from '../../test/__mocks__/canvasEditorMock';

// canvas-editor 在 jsdom 中无法初始化（依赖真实 DOM/canvas），仅 mock 构造函数
vi.mock('@hufe921/canvas-editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hufe921/canvas-editor')>()),
  default: class _MockEditor {
    command = mockCommand;
    eventBus = mockEventBus;
    override = { ...mockOverride };
    destroy = vi.fn();
  },
}));

// WordEditor 挂载时会同步页眉/页脚/页码配置（Object.assign 到 options 上），补齐默认 options
mockCommand.getOptions.mockReturnValue({
  width: 794,
  height: 1123,
  paperDirection: 'vertical',
  pageMode: 'paging',
  scale: 1,
  printPixelRatio: 3,
  header: {},
  footer: {},
  pageNumber: {},
});

describe('WordEditor', () => {
  it('根节点保留 min-w-[960px]，加载后进入编辑态', async () => {
    setDefaultStorage(memoryStorage());
    const doc = createWordDocument({ title: '测试文档' });
    await getDefaultStorage().save(doc);

    const { container } = render(<WordEditor docId={doc.id} />);
    await waitFor(() => {
      const shell = container.firstElementChild as HTMLElement | null;
      expect(shell?.className).toMatch(/min-w-\[960px\]/);
    });
    expect(useDocumentStore.getState().currentDocument?.id).toBe(doc.id);
  });

  it('branding 传入时渲染品牌区', async () => {
    setDefaultStorage(memoryStorage());
    const doc = createWordDocument({ title: '测试文档' });
    await getDefaultStorage().save(doc);

    const { findByText } = render(
      <WordEditor docId={doc.id} branding={{ logo: '/logo.png', name: '测试品牌' }} />,
    );
    expect(await findByText('测试品牌')).toBeTruthy();
  });

  it('文档不存在时回调 onDocError', async () => {
    setDefaultStorage(memoryStorage());
    const onDocError = vi.fn();
    render(<WordEditor docId="missing-doc" onDocError={onDocError} />);
    await waitFor(() => expect(onDocError).toHaveBeenCalled());
  });

  it('新建文档后经 onDocIdChange 通知宿主（路由由宿主同步）', async () => {
    setDefaultStorage(memoryStorage());
    const doc = createWordDocument({ title: '第一篇' });
    await getDefaultStorage().save(doc);
    const onDocIdChange = vi.fn();

    render(<WordEditor docId={doc.id} onDocIdChange={onDocIdChange} />);
    await waitFor(() => expect(useDocumentStore.getState().currentDocument?.id).toBe(doc.id));

    await useDocumentStore.getState().createAndOpenDocument('第二篇');
    await waitFor(() => expect(onDocIdChange).toHaveBeenCalledWith(expect.any(String)));
  });
});

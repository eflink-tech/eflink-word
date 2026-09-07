import { describe, expect, it } from 'vitest';
import { buildDocPrompt, parseAIDocument, parseJSONFromText } from './systemPrompt';

describe('parseJSONFromText', () => {
  it('解析裸 JSON', () => {
    expect(parseJSONFromText('{"a":1}')).toEqual({ a: 1 });
  });
  it('剥掉 markdown 代码块', () => {
    expect(parseJSONFromText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('截取首尾大括号', () => {
    expect(parseJSONFromText('好的，以下是结果：{"a":1} 请查收')).toEqual({ a: 1 });
  });
  it('非法输入抛错', () => {
    expect(() => parseJSONFromText('不是JSON')).toThrow();
  });
});

describe('parseAIDocument', () => {
  it('解析标题/段落/列表/表格', () => {
    const doc = parseAIDocument(
      '{"title":"报告","elements":[{"type":"title","level":1,"text":"标题"},{"type":"paragraph","text":"段落"},{"type":"list","ordered":true,"items":["一","二"]},{"type":"table","header":["列A","列B"],"rows":[["1","2"]]}]}',
    );
    expect(doc.title).toBe('报告');
    expect(doc.elements).toHaveLength(4);
    expect(doc.elements[0]).toEqual({ type: 'title', level: 1, text: '标题' });
    expect(doc.elements[2]).toEqual({ type: 'list', ordered: true, items: ['一', '二'] });
    expect(doc.elements[3]).toEqual({ type: 'table', header: ['列A', '列B'], rows: [['1', '2']] });
  });
  it('丢弃非法元素、标题级别收敛到 1-6、空文本段落被过滤', () => {
    const doc = parseAIDocument(
      '{"elements":[{"type":"image"},{"type":"title","level":99,"text":"标题"},{"type":"paragraph","text":"  "},{"type":"list","items":[null,"ok"]}]}',
    );
    expect(doc.elements).toHaveLength(2);
    expect(doc.elements[0]).toEqual({ type: 'title', level: 6, text: '标题' });
    expect(doc.elements[1]).toEqual({ type: 'list', ordered: false, items: ['ok'] });
  });
  it('无有效元素抛错', () => {
    expect(() => parseAIDocument('{"elements":[]}')).toThrow();
    expect(() => parseAIDocument('{"a":1}')).toThrow();
  });
});

describe('buildDocPrompt', () => {
  it('包含主题与要求', () => {
    const prompt = buildDocPrompt('项目复盘', '500 字');
    expect(prompt).toContain('项目复盘');
    expect(prompt).toContain('500 字');
    expect(prompt).toContain('"elements"');
  });
});

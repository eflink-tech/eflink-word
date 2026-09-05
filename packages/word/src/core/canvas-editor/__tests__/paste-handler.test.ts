import { describe, it, expect } from 'vitest';
import { cleanPasteHTML, htmlToPlainText } from '../paste-handler';

describe('cleanPasteHTML', () => {
  it('移除 block 元素之后的多余 <br>', () => {
    const input = '</p><br><p>下一段</p>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('</p><p>下一段</p>');
  });

  it('移除 div 之后的多余 <br>', () => {
    const input = '</div><br><div>内容</div>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('</div><div>内容</div>');
  });

  it('移除 block 元素之前的多余 <br>', () => {
    const input = '<br><p>段落</p>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('<p>段落</p>');
  });

  it('将连续多个 <br> 合并为一个', () => {
    const input = '文本<br><br><br>更多文本';
    const result = cleanPasteHTML(input);
    expect(result).toBe('文本<br>更多文本');
  });

  it('移除空段落', () => {
    const input = '<p></p><p>有内容</p><p><br></p>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('<p>有内容</p>');
  });

  it('移除空 div', () => {
    const input = '<div></div><div>有内容</div>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('<div>有内容</div>');
  });

  it('移除 HTML 注释', () => {
    const input = '<!-- 注释 --><p>内容</p>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('<p>内容</p>');
  });

  it('移除 Word mso- 前缀 CSS 属性', () => {
    const input = '<p style="mso-line-rule: inside; color: red;">内容</p>';
    const result = cleanPasteHTML(input);
    expect(result).not.toContain('mso-');
    expect(result).toContain('color: red');
  });

  it('处理复杂的 Word 粘贴 HTML', () => {
    const input = `
      <!--[if gte mso 9]><xml>...</xml><![endif]-->
      <p style="mso-bidi-font-size:12.0pt">第一段</p>
      <br>
      <br>
      <p></p>
      <p>第二段</p>
    `;
    const result = cleanPasteHTML(input);
    expect(result).not.toContain('<!--');
    expect(result).not.toContain('mso-');
    expect(result).toContain('第一段');
    expect(result).toContain('第二段');
    expect(result).not.toMatch(/<p>\s*<\/p>/);
  });

  it('保留内联 <br>（行内换行）', () => {
    const input = '第一行<br>第二行';
    const result = cleanPasteHTML(input);
    expect(result).toBe('第一行<br>第二行');
  });

  it('trim 首尾空白', () => {
    const input = '  <p>内容</p>  ';
    const result = cleanPasteHTML(input);
    expect(result).toBe('<p>内容</p>');
  });

  it('处理标题后的 <br>', () => {
    const input = '<h1>标题</h1><br><p>正文</p>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('<h1>标题</h1><p>正文</p>');
  });

  it('处理 li 后的 <br>', () => {
    const input = '<li>项目</li><br><li>下一项</li>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('<li>项目</li><li>下一项</li>');
  });

  it('移除 margin/padding/line-height 样式', () => {
    const input = '<p style="margin-bottom: 10px; color: red;">内容</p>';
    const result = cleanPasteHTML(input);
    expect(result).not.toContain('margin');
    expect(result).toContain('color: red');
  });

  it('移除 line-height 样式', () => {
    const input = '<div style="line-height: 1.5;">内容</div>';
    const result = cleanPasteHTML(input);
    expect(result).not.toContain('line-height');
  });

  it('移除含 &nbsp; 的空段落', () => {
    const input = '<p>&nbsp;</p><p>内容</p>';
    const result = cleanPasteHTML(input);
    expect(result).toBe('<p>内容</p>');
  });
});

describe('htmlToPlainText', () => {
  it('将 <p> 边界转为换行', () => {
    const input = '<p>第一行</p><p>第二行</p>';
    const result = htmlToPlainText(input);
    expect(result).toBe('第一行\n第二行');
  });

  it('将 <div> 边界转为换行', () => {
    const input = '<div>第一行</div><div>第二行</div>';
    const result = htmlToPlainText(input);
    expect(result).toBe('第一行\n第二行');
  });

  it('将 <br> 转为换行', () => {
    const input = '第一行<br>第二行';
    const result = htmlToPlainText(input);
    expect(result).toBe('第一行\n第二行');
  });

  it('移除所有 HTML 标签', () => {
    const input = '<p style="color: red;"><b>加粗</b> 文本</p>';
    const result = htmlToPlainText(input);
    expect(result).toBe('加粗 文本');
  });

  it('解码 HTML 实体', () => {
    const input = '<p>&lt;标签&gt; &amp; &quot;引号&quot;</p>';
    const result = htmlToPlainText(input);
    expect(result).toBe('<标签> & "引号"');
  });

  it('将 &nbsp; 转为空格', () => {
    const input = '<p>单词1&nbsp;单词2</p>';
    const result = htmlToPlainText(input);
    expect(result).toBe('单词1 单词2');
  });

  it('合并连续空行', () => {
    const input = '<p>第一段</p><p></p><p></p><p></p><p>第二段</p>';
    const result = htmlToPlainText(input);
    expect(result).toBe('第一段\n\n第二段');
  });

  it('处理列表结构', () => {
    const input = '<ul><li>项目1</li><li>项目2</li></ul>';
    const result = htmlToPlainText(input);
    expect(result).toBe('项目1\n项目2');
  });
});

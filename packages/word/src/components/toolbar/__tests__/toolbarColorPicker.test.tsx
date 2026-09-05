import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ColorPicker, recentStorageKeyForMode } from '../ColorPicker';
import { loadRecent } from '../../../components/color/recentColors';

describe('recentStorageKeyForMode', () => {
  it('maps each mode to a distinct storage key', () => {
    expect(recentStorageKeyForMode('color')).toBe('eflink-word:recent-colors:color');
    expect(recentStorageKeyForMode('highlight')).toBe('eflink-word:recent-colors:highlight');
    expect(recentStorageKeyForMode('shading')).toBe('eflink-word:recent-colors:shading');
  });
});

describe('toolbar ColorPicker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shading mode updates bar color via controlled value', () => {
    const onSelect = vi.fn();
    const onDefault = vi.fn();
    const { rerender } = render(
      <ColorPicker mode="shading" value={null} onSelect={onSelect} onDefault={onDefault} />,
    );

    const bar = screen.getByTestId('toolbar-color-bar');
    expect(bar).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255)' });

    fireEvent.click(screen.getByRole('button', { name: '底纹颜色' }));

    const themeButtons = screen.getAllByTestId('theme-color');
    fireEvent.click(themeButtons[1]!);

    // 受控组件：onSelect 被调用，颜色变化由父组件传入的 value 驱动
    expect(onSelect).toHaveBeenCalledWith('#000000', undefined);

    // 父组件将 value 更新为 '#000000' 后，色条随之变化
    rerender(
      <ColorPicker mode="shading" value="#000000" onSelect={onSelect} onDefault={onDefault} />,
    );
    expect(bar).toHaveStyle({ backgroundColor: 'rgb(0, 0, 0)' });
  });

  it('shading advanced panel select pushes recent', () => {
    const key = recentStorageKeyForMode('shading');
    const onSelect = vi.fn();
    const onDefault = vi.fn();

    render(
      <ColorPicker mode="shading" value={null} onSelect={onSelect} onDefault={onDefault} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '底纹颜色' }));
    fireEvent.click(screen.getByRole('button', { name: /更多颜色/ }));

    const hexInput = screen.getByLabelText('Hex');
    fireEvent.change(hexInput, { target: { value: 'FF0000' } });

    expect(loadRecent(key)[0]).toBe('#ff0000');
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    expect(screen.getByTestId('sv-area')).toBeInTheDocument();
  });

  it('color mode advanced panel keeps popover open while adjusting', () => {
    const onSelect = vi.fn();
    const onDefault = vi.fn();

    render(
      <ColorPicker mode="color" value={null} onSelect={onSelect} onDefault={onDefault} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '字体颜色' }));
    fireEvent.click(screen.getByRole('button', { name: /更多颜色/ }));

    const hexInput = screen.getByLabelText('Hex');
    fireEvent.change(hexInput, { target: { value: 'FF0000' } });

    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    expect(screen.getByTestId('sv-area')).toBeInTheDocument();
  });

  it('color mode invokes onSelect callback on theme color click', () => {
    const onSelect = vi.fn();
    const onDefault = vi.fn();

    render(
      <ColorPicker mode="color" value={null} onSelect={onSelect} onDefault={onDefault} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '字体颜色' }));
    const themeButtons = screen.getAllByTestId('theme-color');
    fireEvent.click(themeButtons[0]!);

    expect(onSelect).toHaveBeenCalledWith('#ffffff', undefined);
  });

  it('default button invokes onDefault callback', () => {
    const onSelect = vi.fn();
    const onDefault = vi.fn();

    render(
      <ColorPicker mode="highlight" value="#ffff00" onSelect={onSelect} onDefault={onDefault} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '高亮' }));
    const defaultBtn = screen.getByRole('button', { name: /默认/ });
    fireEvent.click(defaultBtn);

    expect(onDefault).toHaveBeenCalled();
  });
});

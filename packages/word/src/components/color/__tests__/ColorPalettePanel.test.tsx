import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ColorPalettePanel } from '../ColorPalettePanel';

describe('ColorPalettePanel', () => {
  it('renders section labels and color grids', () => {
    render(
      <ColorPalettePanel
        recent={['#ff0000']}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
        onMore={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '默认' })).toBeInTheDocument();
    expect(screen.getByText('标准色')).toBeInTheDocument();
    expect(screen.getByText('最近使用')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /更多颜色/ })).toBeInTheDocument();

    expect(screen.getAllByTestId('theme-color')).toHaveLength(60);
    expect(screen.getAllByTestId('standard-color')).toHaveLength(10);
    expect(screen.getAllByTestId('recent-slot')).toHaveLength(10);
  });

  it('calls callbacks for default, select, and more', () => {
    const onSelect = vi.fn();
    const onDefault = vi.fn();
    const onMore = vi.fn();

    render(
      <ColorPalettePanel
        recent={[]}
        onSelect={onSelect}
        onDefault={onDefault}
        onMore={onMore}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '默认' }));
    expect(onDefault).toHaveBeenCalledTimes(1);

    const themeButtons = screen.getAllByTestId('theme-color');
    fireEvent.click(themeButtons[0]!);
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /更多颜色/ }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('shows empty recent slots when recent is empty', () => {
    render(
      <ColorPalettePanel
        recent={[]}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
        onMore={vi.fn()}
      />,
    );

    const slots = screen.getAllByTestId('recent-slot');
    for (const slot of slots) {
      expect(slot).toHaveAttribute('data-filled', 'false');
    }
  });

  it('fills recent slots from props', () => {
    render(
      <ColorPalettePanel
        recent={['#ff0000', '#00ff00']}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
        onMore={vi.fn()}
      />,
    );

    const slots = screen.getAllByTestId('recent-slot');
    expect(slots[0]).toHaveAttribute('data-filled', 'true');
    expect(slots[1]).toHaveAttribute('data-filled', 'true');
    expect(slots[2]).toHaveAttribute('data-filled', 'false');
  });
});

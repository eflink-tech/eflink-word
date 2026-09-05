import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ColorPicker } from '../ColorPicker';
import { loadRecent, pushRecent } from '../recentColors';

const STORAGE_KEY = 'test:color-picker';

describe('ColorPicker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing when closed', () => {
    render(
      <ColorPicker
        open={false}
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '默认' })).not.toBeInTheDocument();
  });

  it('loads recent colors when opened', () => {
    pushRecent(STORAGE_KEY, '#ff0000');

    render(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
      />,
    );

    const slots = screen.getAllByTestId('recent-slot');
    expect(slots[0]).toHaveAttribute('data-filled', 'true');
  });

  it('calls onSelect and pushes recent when a color is selected', () => {
    const onSelect = vi.fn();

    render(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={onSelect}
        onDefault={vi.fn()}
      />,
    );

    const themeButtons = screen.getAllByTestId('theme-color');
    fireEvent.click(themeButtons[0]!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.stringMatching(/^#[0-9a-f]{6}$/));
    const selected = onSelect.mock.calls[0]![0] as string;
    expect(loadRecent(STORAGE_KEY)[0]).toBe(selected);
  });

  it('advanced panel onChange calls onSelect with close false', () => {
    const onSelect = vi.fn();

    render(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={onSelect}
        onDefault={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /更多颜色/ }));

    const hexInput = screen.getByLabelText('Hex');
    fireEvent.change(hexInput, { target: { value: 'FF0000' } });

    expect(onSelect).toHaveBeenCalledWith('#ff0000', { close: false });
  });

  it('calls onDefault without pushing recent', () => {
    const onDefault = vi.fn();

    render(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={onDefault}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '默认' }));

    expect(onDefault).toHaveBeenCalledTimes(1);
    expect(loadRecent(STORAGE_KEY)).toHaveLength(0);
  });

  it('shows advanced panel when more colors is clicked', () => {
    render(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('sv-area')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /更多颜色/ }));

    expect(screen.getByTestId('sv-area')).toBeInTheDocument();
  });

  it('closes advanced panel when picker closes', () => {
    const { rerender } = render(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /更多颜色/ }));
    expect(screen.getByTestId('sv-area')).toBeInTheDocument();

    rerender(
      <ColorPicker
        open={false}
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('sv-area')).not.toBeInTheDocument();

    rerender(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('sv-area')).not.toBeInTheDocument();
  });

  it('opens advanced beside palette without changing palette layout (absolute, not in-flow)', () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 });

    render(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
      />,
    );

    const root = screen.getByTestId('color-picker');
    root.getBoundingClientRect = () =>
      ({
        left: 200,
        right: 440,
        top: 40,
        bottom: 340,
        width: 240,
        height: 300,
        x: 200,
        y: 40,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(screen.getByRole('button', { name: /更多颜色/ }));

    expect(screen.getByTestId('sv-area')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker')).toHaveAttribute('data-advanced-side', 'left');
    const anchor = screen.getByTestId('advanced-panel-anchor');
    expect(anchor.className).toMatch(/absolute/);
    expect(anchor.className).toMatch(/right-full/);
    expect(root.style.transform).toBe('');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
  });

  it('applies className to root container', () => {
    render(
      <ColorPicker
        open
        onOpenChange={vi.fn()}
        recentStorageKey={STORAGE_KEY}
        onSelect={vi.fn()}
        onDefault={vi.fn()}
        className="custom-picker"
      />,
    );

    expect(screen.getByTestId('color-picker')).toHaveClass('custom-picker');
  });
});

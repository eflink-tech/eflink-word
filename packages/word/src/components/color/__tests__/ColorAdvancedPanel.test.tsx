import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ColorAdvancedPanel } from '../ColorAdvancedPanel';

describe('ColorAdvancedPanel', () => {
  it('renders SV, hue, alpha, preview, and inputs', () => {
    render(<ColorAdvancedPanel value="#333333" onChange={vi.fn()} />);

    expect(screen.getByTestId('sv-area')).toBeInTheDocument();
    expect(screen.getByTestId('hue-slider')).toBeInTheDocument();
    expect(screen.getByTestId('alpha-slider')).toBeInTheDocument();
    expect(screen.getByTestId('color-preview')).toBeInTheDocument();
    expect(screen.getByLabelText('Hex')).toBeInTheDocument();
    expect(screen.getByLabelText('R')).toBeInTheDocument();
    expect(screen.getByLabelText('G')).toBeInTheDocument();
    expect(screen.getByLabelText('B')).toBeInTheDocument();
    expect(screen.getByLabelText('A')).toBeInTheDocument();
  });

  it('initializes from value prop', () => {
    render(<ColorAdvancedPanel value="#ff0000" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Hex')).toHaveValue('FF0000');
    expect(screen.getByLabelText('R')).toHaveValue(255);
    expect(screen.getByLabelText('G')).toHaveValue(0);
    expect(screen.getByLabelText('B')).toHaveValue(0);
    expect(screen.getByLabelText('A')).toHaveValue(100);
  });

  it('falls back to #333333 when value is invalid', () => {
    render(<ColorAdvancedPanel value="nope" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Hex')).toHaveValue('333333');
    expect(screen.getByLabelText('A')).toHaveValue(100);
  });

  it('calls onChange when hex input changes', () => {
    const onChange = vi.fn();

    render(<ColorAdvancedPanel value="#333333" onChange={onChange} />);

    const hexInput = screen.getByLabelText('Hex');
    fireEvent.change(hexInput, { target: { value: 'FF0000' } });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toBe('#ff0000');
  });

  it('calls onChange with rgba when alpha is below 100', () => {
    const onChange = vi.fn();

    render(<ColorAdvancedPanel value="#ff0000" onChange={onChange} />);

    const alphaInput = screen.getByLabelText('A');
    fireEvent.change(alphaInput, { target: { value: '50' } });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toMatch(/rgba\(255,\s*0,\s*0,\s*0\.5\)/);
  });
});

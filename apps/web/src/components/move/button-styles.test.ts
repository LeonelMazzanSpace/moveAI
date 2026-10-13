import { describe, expect, it } from 'vitest';
import { moveButton, moveButtonSize } from './button-styles';

const LETTERING = ['text-[10px]', 'font-semibold', 'uppercase', 'tracking-[0.2em]'];

describe('moveButtonSize', () => {
  it('adds the MOVE lettering and the compact padding by default', () => {
    const classes = moveButtonSize().split(' ');
    expect(classes).toEqual(expect.arrayContaining([...LETTERING, 'h-auto', 'px-3.5', 'py-1.5']));
  });

  it.each([
    ['cta', ['px-5', 'py-2.5']],
    ['block', ['w-full', 'py-2.5']],
  ] as const)('uses the %s padding', (size, padding) => {
    expect(moveButtonSize({ size }).split(' ')).toEqual(expect.arrayContaining([...LETTERING, ...padding]));
  });

  it('lets the className win over the size padding', () => {
    const classes = moveButtonSize({ size: 'compact', className: 'px-2 mt-4' }).split(' ');
    expect(classes).toContain('px-2');
    expect(classes).toContain('mt-4');
    expect(classes).not.toContain('px-3.5');
  });
});

describe('moveButton', () => {
  it('is the primary variant by default', () => {
    const classes = moveButton().split(' ');
    expect(classes).toEqual(expect.arrayContaining(['bg-primary', 'text-primary-foreground', ...LETTERING]));
  });

  it('carries the variant of the shared button', () => {
    expect(moveButton({ variant: 'outline' }).split(' ')).toEqual(expect.arrayContaining(['border-border', 'bg-background']));
    expect(moveButton({ variant: 'destructive' }).split(' ')).toContain('text-destructive');
    expect(moveButton({ variant: 'outline' }).split(' ')).not.toContain('bg-primary');
  });

  it('spells the lettering once and lets the className override the layout', () => {
    const classes = moveButton({ size: 'cta', className: 'hidden md:inline-flex w-fit' }).split(' ');
    expect(classes.filter((name) => name === 'uppercase')).toHaveLength(1);
    expect(classes).toEqual(expect.arrayContaining(['hidden', 'md:inline-flex', 'w-fit']));
    expect(classes).not.toContain('inline-flex');
  });
});

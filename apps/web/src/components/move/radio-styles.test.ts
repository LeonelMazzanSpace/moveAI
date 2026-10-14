import { describe, expect, it } from 'vitest';
import { RADIO_CLASS } from './radio-styles';

const classes = RADIO_CLASS.split(' ');

describe('RADIO_CLASS', () => {
  it('draws its own circle instead of the native radio', () => {
    expect(classes).toEqual(expect.arrayContaining(['appearance-none', 'rounded-full', 'border-2', 'border-muted-foreground']));
  });

  it('highlights the chosen radio with the foreground border and an inner dot', () => {
    expect(classes).toContain('checked:border-foreground');
    expect(classes.some((name) => name.startsWith('checked:bg-[radial-gradient(') && name.includes('currentColor'))).toBe(true);
  });

  it('shows a focus ring for the keyboard', () => {
    expect(classes).toContain('focus-visible:ring-3');
  });

  it('only uses theme tokens, never a hex color', () => {
    expect(RADIO_CLASS).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

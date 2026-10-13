import { describe, expect, it } from 'vitest';
import { clampPage } from './pagination';

describe('clampPage', () => {
  it.each([
    [undefined, 1],
    ['abc', 1],
    ['0', 1],
    ['-3', 1],
    ['2.5', 1],
    ['3', 3],
    ['10000', 10_000],
    ['10001', 10_000],
    ['1e21', 10_000],
  ])('turns %s into page %i', (raw, expected) => {
    expect(clampPage(raw)).toBe(expected);
  });
});

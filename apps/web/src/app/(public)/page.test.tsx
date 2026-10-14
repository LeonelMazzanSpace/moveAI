import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server', () => ({ serverApiFetch: vi.fn() }));

const { default: HomePage } = await import('./page');
const { TeamSection } = await import('@/components/public/team-section');
const { Eyebrow } = await import('@/components/move/eyebrow');
const { AccountCta } = await import('@/components/public/account-cta');

/** Marker of each landing block, in document order: the eyebrows written in the page, and the components that own theirs. */
function landingBlocks(node: ReactNode): string[] {
  const blocks: string[] = [];
  const visit = (child: ReactNode) => {
    if (!isValidElement<{ children?: ReactNode; index?: string }>(child)) return;
    if (child.type === Eyebrow) blocks.push(`eyebrow ${child.props.index}`);
    else if (child.type === TeamSection) blocks.push('team');
    else if (child.type === AccountCta) blocks.push('account-cta');
    else if (typeof child.type === 'function' && child.type.name === 'HomeContact') blocks.push('contact');
    Children.forEach(child.props.children, visit);
  };
  Children.forEach(node, visit);
  return blocks;
}

describe('home page composition', () => {
  const blocks = landingBlocks((HomePage as () => ReactElement)());

  it('keeps the numbered sections in order: Servicios 01, Equipo 02, Planes 03, then the contact block (04) last', () => {
    expect(blocks).toEqual(['eyebrow 01', 'team', 'eyebrow 03', 'account-cta', 'contact']);
  });

  it('puts the contact block after the account call to action, at the very end', () => {
    expect(blocks.at(-1)).toBe('contact');
    expect(blocks.indexOf('account-cta')).toBe(blocks.length - 2);
  });
});

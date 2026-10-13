import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the text with the tone class', () => {
    render(<StatusBadge tone="success">Activo</StatusBadge>);
    expect(screen.getByText('Activo').className).toContain('text-success');
  });
});

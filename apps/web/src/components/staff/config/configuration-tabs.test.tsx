import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./calendar-tab', () => ({ CalendarTab: () => <p>pestaña calendario</p> }));
vi.mock('./contact-tab', () => ({ ContactTab: () => <p>pestaña contacto</p> }));
vi.mock('./plans-tab', () => ({ PlansTab: () => <p>pestaña planes</p> }));
vi.mock('./professionals-tab', () => ({ ProfessionalsTab: () => <p>pestaña profesionales</p> }));
vi.mock('./rules-tab', () => ({ RulesTab: () => <p>pestaña reglas</p> }));
vi.mock('./schedule-tab', () => ({ ScheduleTab: () => <p>pestaña horarios</p> }));

const { ConfigurationTabs, parseTab } = await import('./configuration-tabs');

// Testing Library no renderiza componentes async de servidor: se resuelve a mano el que arma las pestañas.
async function renderTabs(tab?: string | string[]) {
  return render(await ConfigurationTabs({ searchParams: Promise.resolve({ tab }) }));
}

const TAB_CONTENT = {
  planes: 'pestaña planes',
  horarios: 'pestaña horarios',
  profesionales: 'pestaña profesionales',
  reglas: 'pestaña reglas',
  contacto: 'pestaña contacto',
  calendario: 'pestaña calendario',
} as const;

describe('ConfigurationTabs navigation', () => {
  it('keeps the six tabs in one row that scrolls on its own, so the page never scrolls sideways at 375 px', async () => {
    await renderTabs('calendario');
    const nav = screen.getByRole('navigation', { name: 'Secciones de configuración' });
    expect(nav).toHaveClass('flex', 'overflow-x-auto');
    expect(nav).not.toHaveClass('flex-wrap');
    const tabs = [...nav.querySelectorAll('a')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Planes', 'Horarios', 'Profesionales', 'Reglas', 'Contacto', 'Calendario']);
    for (const tab of tabs) expect(tab).toHaveClass('shrink-0');
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page');
  });

  it('links each tab to its own query parameter', async () => {
    await renderTabs();
    expect(screen.getByRole('link', { name: 'Contacto' })).toHaveAttribute('href', '/staff/configuracion?tab=contacto');
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', '/staff/configuracion?tab=calendario');
  });
});

describe('ConfigurationTabs content', () => {
  it.each(Object.entries(TAB_CONTENT))('shows only the %s tab for ?tab=%s', async (tab, text) => {
    await renderTabs(tab);
    expect(screen.getByText(text)).toBeInTheDocument();
    for (const other of Object.values(TAB_CONTENT).filter((value) => value !== text)) {
      expect(screen.queryByText(other)).toBeNull();
    }
  });

  it.each([undefined, '', 'nope', 'PLANES', '__proto__', 'constructor'])('falls back to Planes for tab=%j', async (tab) => {
    await renderTabs(tab);
    expect(screen.getByText('pestaña planes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Planes' })).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to Planes when the parameter is repeated', async () => {
    await renderTabs(['contacto', 'reglas']);
    expect(screen.getByText('pestaña planes')).toBeInTheDocument();
  });
});

describe('parseTab', () => {
  it('only returns a known tab', () => {
    expect(parseTab('contacto')).toBe('contacto');
    expect(parseTab('hacked')).toBe('planes');
    expect(parseTab(undefined)).toBe('planes');
  });
});

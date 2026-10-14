import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/move/staff-page-header', () => ({ StaffPageHeader: () => null }));
vi.mock('@/components/staff/config/calendar-tab', () => ({ CalendarTab: () => null }));
vi.mock('@/components/staff/config/contact-tab', () => ({ ContactTab: () => null }));
vi.mock('@/components/staff/config/plans-tab', () => ({ PlansTab: () => null }));
vi.mock('@/components/staff/config/professionals-tab', () => ({ ProfessionalsTab: () => null }));
vi.mock('@/components/staff/config/rules-tab', () => ({ RulesTab: () => null }));
vi.mock('@/components/staff/config/schedule-tab', () => ({ ScheduleTab: () => null }));

const { default: ConfigurationPage } = await import('./page');

type PageProps = ComponentProps<typeof ConfigurationPage>;
type TabsElement = ReactElement<PageProps, (props: PageProps) => Promise<ReactNode>>;

// Testing Library no renderiza componentes async de servidor: se resuelve a mano el que arma las pestañas.
async function renderTabs(searchParams: PageProps['searchParams']) {
  const page = ConfigurationPage({ searchParams }) as ReactElement<{ children: ReactElement<{ children: TabsElement }>[] }>;
  const tabs = page.props.children[1].props.children;
  return render(await tabs.type(tabs.props));
}

describe('/staff/configuracion tab navigation', () => {
  it('keeps the six tabs in one row that scrolls on its own, so the page never scrolls sideways at 375 px', async () => {
    await renderTabs(Promise.resolve({ tab: 'calendario' }));
    const nav = screen.getByRole('navigation', { name: 'Secciones de configuración' });
    expect(nav).toHaveClass('flex', 'overflow-x-auto');
    expect(nav).not.toHaveClass('flex-wrap');
    const tabs = [...nav.querySelectorAll('a')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Planes', 'Horarios', 'Profesionales', 'Reglas', 'Contacto', 'Calendario']);
    for (const tab of tabs) expect(tab).toHaveClass('shrink-0');
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page');
  });
});

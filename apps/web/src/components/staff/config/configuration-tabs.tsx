import Link from 'next/link';
import { moveButton } from '@/components/move/button-styles';
import { CalendarTab } from './calendar-tab';
import { ContactTab } from './contact-tab';
import { PlansTab } from './plans-tab';
import { ProfessionalsTab } from './professionals-tab';
import { RulesTab } from './rules-tab';
import { ScheduleTab } from './schedule-tab';

const TABS = [
  { value: 'planes', label: 'Planes' },
  { value: 'horarios', label: 'Horarios' },
  { value: 'profesionales', label: 'Profesionales' },
  { value: 'reglas', label: 'Reglas' },
  { value: 'contacto', label: 'Contacto' },
  { value: 'calendario', label: 'Calendario' },
] as const;

type TabValue = (typeof TABS)[number]['value'];
type SearchParams = Promise<{ tab?: string | string[] }>;

export function parseTab(value: string | string[] | undefined): TabValue {
  return TABS.find((tab) => tab.value === value)?.value ?? 'planes';
}

function TabContent({ tab }: { tab: TabValue }) {
  if (tab === 'horarios') return <ScheduleTab />;
  if (tab === 'profesionales') return <ProfessionalsTab />;
  if (tab === 'reglas') return <RulesTab />;
  if (tab === 'contacto') return <ContactTab />;
  if (tab === 'calendario') return <CalendarTab />;
  return <PlansTab />;
}

export async function ConfigurationTabs({ searchParams }: { searchParams: SearchParams }) {
  const active = parseTab((await searchParams).tab);
  return (
    <div className="space-y-6">
      <nav aria-label="Secciones de configuración" className="flex gap-2 overflow-x-auto border-b border-border pb-4">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/staff/configuracion?tab=${tab.value}`}
            aria-current={tab.value === active ? 'page' : undefined}
            className={moveButton({ variant: tab.value === active ? 'default' : 'outline', className: 'shrink-0' })}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <TabContent tab={active} />
    </div>
  );
}

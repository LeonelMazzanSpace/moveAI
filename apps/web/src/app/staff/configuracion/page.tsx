import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { moveButton } from '@/components/move/button-styles';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { PlansTab } from '@/components/staff/config/plans-tab';
import { ProfessionalsTab } from '@/components/staff/config/professionals-tab';
import { RulesTab } from '@/components/staff/config/rules-tab';
import { ScheduleTab } from '@/components/staff/config/schedule-tab';

export const metadata: Metadata = { title: 'Configuración' };

const TABS = [
  { value: 'planes', label: 'Planes' },
  { value: 'horarios', label: 'Horarios' },
  { value: 'profesionales', label: 'Profesionales' },
  { value: 'reglas', label: 'Reglas' },
] as const;

type TabValue = (typeof TABS)[number]['value'];
type SearchParams = Promise<{ tab?: string | string[] }>;

function parseTab(value: string | string[] | undefined): TabValue {
  return TABS.find((tab) => tab.value === value)?.value ?? 'planes';
}

function TabContent({ tab }: { tab: TabValue }) {
  if (tab === 'horarios') return <ScheduleTab />;
  if (tab === 'profesionales') return <ProfessionalsTab />;
  if (tab === 'reglas') return <RulesTab />;
  return <PlansTab />;
}

async function ConfigurationTabs({ searchParams }: { searchParams: SearchParams }) {
  const active = parseTab((await searchParams).tab);
  return (
    <div className="space-y-6">
      <nav aria-label="Secciones de configuración" className="flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/staff/configuracion?tab=${tab.value}`}
            aria-current={tab.value === active ? 'page' : undefined}
            className={moveButton({ variant: tab.value === active ? 'default' : 'outline' })}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <TabContent tab={active} />
    </div>
  );
}

export default function ConfigurationPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <StaffPageHeader title="Configuración" />
      <Suspense fallback={null}>
        <ConfigurationTabs searchParams={searchParams} />
      </Suspense>
    </>
  );
}

import { DisplayTitle } from '@/components/move/display-title';
import type { PlanDto } from '@/lib/api/types';
import type { CatalogService } from './plan-filter';
import { PlansSection, PlansUnavailable } from './plans-section';
import { RecoveryModalities } from './recovery-modalities';

const SECTION_TITLE: Record<CatalogService, string> = { performance: 'Performance.', recovery: 'Recovery.' };

export interface CatalogSectionData {
  service: CatalogService;
  plans: PlanDto[];
}

function CatalogSection({ service, plans }: CatalogSectionData) {
  return (
    <div>
      <DisplayTitle size="lg">{SECTION_TITLE[service]}</DisplayTitle>
      <div className="mt-8">
        {service === 'performance' ? (
          <PlansSection plans={plans} ctaLabel="Contratar" hrefFor={(plan) => `/checkout/plan/${plan.slug}`} />
        ) : (
          <RecoveryModalities plans={plans} />
        )}
      </div>
    </div>
  );
}

/** Secciones de `/planes`: un único aviso si todas vienen vacías; si solo una, el aviso va bajo su título. */
export function PlansCatalog({ sections }: { sections: CatalogSectionData[] }) {
  if (sections.every(({ plans }) => plans.length === 0)) return <PlansUnavailable />;

  return (
    <div className="space-y-16">
      {sections.map(({ service, plans }) => (
        <CatalogSection key={service} service={service} plans={plans} />
      ))}
    </div>
  );
}

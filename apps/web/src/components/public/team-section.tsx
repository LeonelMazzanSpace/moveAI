import Image from 'next/image';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';
import { TEAM_INTRO, TEAM_MEMBERS } from './team-data';

export function TeamSection() {
  return (
    <section id="equipo" className="scroll-mt-20 border-t border-border">
      <PageContainer className="py-20">
        <Eyebrow index="02">Quiénes somos</Eyebrow>
        <div className="mt-4">
          <DisplayTitle>El equipo detrás de MOVE</DisplayTitle>
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">{TEAM_INTRO}</p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM_MEMBERS.map((member) => (
            <article key={member.slug} className="flex flex-col overflow-hidden rounded border border-border bg-card">
              <Image
                src={member.photo.src}
                alt={member.photo.alt}
                width={720}
                height={960}
                sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                className="aspect-[3/4] w-full object-cover"
              />
              <div className="flex flex-1 flex-col p-7">
                <h3 className="font-display text-2xl font-extrabold uppercase leading-tight">{member.name}</h3>
                <p className="mt-2 text-sm font-medium text-muted-foreground">{member.role}</p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{member.bio}</p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {member.specialties.map((specialty) => (
                    <li key={specialty} className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                      {specialty}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}

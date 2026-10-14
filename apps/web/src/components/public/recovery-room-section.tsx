import Image from 'next/image';
import { DisplayTitle } from '@/components/move/display-title';
import { PageContainer } from '@/components/move/page-container';
import { RECOVERY_EQUIPMENT, RECOVERY_ROOM_PHOTOS, RECOVERY_ROOM_TEXT } from './recovery-room-data';

export function RecoveryRoomSection() {
  return (
    <section id="recovery-room" className="scroll-mt-20 border-t border-border">
      <PageContainer className="py-16">
        <DisplayTitle size="lg">
          Recovery Room <span className="text-muted-foreground">by MOVE</span>
        </DisplayTitle>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{RECOVERY_ROOM_TEXT}</p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {RECOVERY_ROOM_PHOTOS.map((photo) => (
            <Image
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              width={800}
              height={1000}
              sizes="(min-width:640px) 33vw, 100vw"
              className="aspect-[4/5] w-full rounded border border-border object-cover"
            />
          ))}
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-4 min-[421px]:grid-cols-2 md:grid-cols-5">
          {RECOVERY_EQUIPMENT.map(({ title, description, icon: Icon }) => (
            <li key={title} className="rounded border border-border bg-card p-5">
              <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </PageContainer>
    </section>
  );
}

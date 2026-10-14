import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RECOVERY_EQUIPMENT, RECOVERY_ROOM_PHOTOS, RECOVERY_ROOM_TEXT } from './recovery-room-data';
import { RecoveryRoomSection } from './recovery-room-section';

describe('RecoveryRoomSection', () => {
  it('is the "recovery-room" section with its title and paragraph', () => {
    const { container } = render(<RecoveryRoomSection />);
    expect(container.querySelector('section#recovery-room')).not.toBeNull();
    expect(screen.getByRole('heading', { name: /Recovery Room\s*by MOVE/ })).toBeInTheDocument();
    expect(screen.getByText(RECOVERY_ROOM_TEXT)).toBeInTheDocument();
  });

  it('shows the five equipment cards with title and description', () => {
    render(<RecoveryRoomSection />);
    expect(RECOVERY_EQUIPMENT).toHaveLength(5);
    const titles = [
      'Botas de presoterapia',
      'Luz roja e infrarroja',
      'Sauna infrarrojo',
      'Meditación y respiración',
      'Sillón de gravedad cero',
    ];
    for (const title of titles) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    for (const item of RECOVERY_EQUIPMENT) expect(screen.getByText(item.description)).toBeInTheDocument();
  });

  it('shows the three photos with their alt text', () => {
    render(<RecoveryRoomSection />);
    expect(RECOVERY_ROOM_PHOTOS).toHaveLength(3);
    expect(screen.getByAltText('Sillón de gravedad cero del Recovery Room by MOVE')).toBeInTheDocument();
    expect(screen.getByAltText('Sauna infrarrojo del Recovery Room by MOVE')).toBeInTheDocument();
    expect(screen.getByAltText('Panel de luz roja e infrarroja del Recovery Room by MOVE')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('points each photo to its static file', () => {
    expect(RECOVERY_ROOM_PHOTOS.map((photo) => photo.src)).toEqual([
      '/img/recovery/recovery-zero-gravity-chair.jpg',
      '/img/recovery/recovery-sauna-infrarrojo.jpg',
      '/img/recovery/recovery-luz-roja-panel.jpg',
    ]);
  });
});

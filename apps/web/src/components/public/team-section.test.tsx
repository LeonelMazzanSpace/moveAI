import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TEAM_INTRO, TEAM_MEMBERS } from './team-data';
import { TeamSection } from './team-section';

describe('TeamSection', () => {
  it('is the "equipo" section with its heading and intro', () => {
    const { container } = render(<TeamSection />);
    expect(container.querySelector('section#equipo')).not.toBeNull();
    expect(screen.getByText('02 — Quiénes somos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'El equipo detrás de MOVE' })).toBeInTheDocument();
    expect(screen.getByText(TEAM_INTRO)).toBeInTheDocument();
  });

  it('lists the three members in order with their names and roles', () => {
    render(<TeamSection />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Pierina Paladini', 'Gianluca Pasini', 'Leandro Olenchuk']);
    expect(screen.getByText('Fisioterapeuta deportiva | Co-fundadora')).toBeInTheDocument();
    expect(screen.getByText('Entrenador de fuerza y potencia | Co-fundador')).toBeInTheDocument();
    expect(screen.getByText('Entrenador')).toBeInTheDocument();
  });

  it('shows every specialty of every member as a chip', () => {
    render(<TeamSection />);
    expect(TEAM_MEMBERS.flatMap((member) => member.specialties)).toHaveLength(15);
    for (const member of TEAM_MEMBERS) {
      const card = screen.getByRole('heading', { name: member.name }).closest('article');
      expect(card).not.toBeNull();
      for (const specialty of member.specialties) {
        expect(within(card as HTMLElement).getByText(specialty)).toBeInTheDocument();
      }
      expect(within(card as HTMLElement).getByText(member.bio)).toBeInTheDocument();
    }
  });

  it('shows each photo with its alt text', () => {
    render(<TeamSection />);
    const alts = [
      'Pierina Paladini, fisioterapeuta deportiva y co-fundadora de MOVE®',
      'Gianluca Pasini, entrenador de fuerza y potencia y co-fundador de MOVE®',
      'Leandro Olenchuk, entrenador en MOVE®',
    ];
    for (const alt of alts) expect(screen.getByAltText(alt)).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('points each photo to its static file', () => {
    expect(TEAM_MEMBERS.map((member) => member.photo.src)).toEqual([
      '/img/equipo/pierina-paladini.jpg',
      '/img/equipo/gianluca-pasini.jpg',
      '/img/equipo/leandro-olenchuk.jpg',
    ]);
  });
});

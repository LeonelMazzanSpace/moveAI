export interface TeamMember {
  slug: string;
  name: string;
  role: string;
  bio: string;
  specialties: readonly string[];
  photo: { src: string; alt: string };
}

export const TEAM_INTRO =
  'Formación académica, actualización constante y experiencia en piso. Detrás de cada plan hay profesionales que combinan educación física, fisioterapia y entrenamiento especializado para que entrenes con criterio.';

export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    slug: 'pierina-paladini',
    name: 'Pierina Paladini',
    role: 'Fisioterapeuta deportiva | Co-fundadora',
    bio: 'Licenciada en Fisioterapia y Licenciada en Educación Física, Recreación y Deporte, con 7 años de experiencia clínica y más de 15 entrenando personas. Esa doble formación define su manera de trabajar: no separa el tratamiento del entrenamiento. Cada consulta es individual y diseñada a medida —evaluación clínica, historia de la persona y contexto de vida— porque ningún cuerpo responde igual y ahí está la diferencia en los resultados. Acompaña tanto a deportistas como a personas que llegan con dolor —agudo o crónico—, con una lesión o con miedo a volver a moverse, combinando herramientas de alta tecnología y progresión medida. El objetivo no es solo que el cuerpo deje de doler, sino que vuelva a rendir. En MOVE lidera el área de fisioterapia y conecta el tratamiento con el entrenamiento y la recuperación.',
    specialties: [
      'Ecografía músculo-esquelética',
      'Punción seca',
      'Neuromodulación',
      'MEP Sport',
      'MEP eco-guiado',
      'Ondas de Choque',
      'Tecarterapia',
      'Entrenamiento terapéutico',
    ],
    photo: {
      src: '/img/equipo/pierina-paladini.jpg',
      alt: 'Pierina Paladini, fisioterapeuta deportiva y co-fundadora de MOVE®',
    },
  },
  {
    slug: 'gianluca-pasini',
    name: 'Gianluca Pasini',
    role: 'Entrenador de fuerza y potencia | Co-fundador',
    bio: 'Entrenador especializado en fuerza y potencia, con más de 10 años de experiencia en entrenamiento deportivo y 4 como preparador físico de un equipo de rugby de primera división. Ex jugador de la selección uruguaya de rugby, representó al país en un mundial: conoce desde adentro lo que exige el deporte de elite y lo que significa volver a competir después de una lesión. Hoy también planifica preparación física a online para futbolistas profesionales en Europa. En MOVE dirige el área de entrenamiento, donde trabaja con planificación individualizada, control de cargas y progresión medida —el mismo criterio del alto rendimiento— tanto con atletas como con personas que entrenan para sentirse mejor. Es quien toma el trabajo donde termina la rehabilitación y lo lleva hasta el rendimiento.',
    specialties: ['Fuerza y potencia', 'Readaptación deportiva', 'Alto rendimiento', 'Planificación individualizada'],
    photo: {
      src: '/img/equipo/gianluca-pasini.jpg',
      alt: 'Gianluca Pasini, entrenador de fuerza y potencia y co-fundador de MOVE®',
    },
  },
  {
    slug: 'leandro-olenchuk',
    name: 'Leandro Olenchuk',
    role: 'Entrenador',
    bio: 'Técnico en Fitness, actualmente cursando el último año de la Licenciatura en Educación Física. Siete años de experiencia en el área de entrenamiento, con formación específica en preparación física para deportes de equipo, y dos años como preparador físico de un equipo de fútbol de la Liga Montevideana. En MOVE está a cargo del acompañamiento en sala: supervisa la técnica, controla las cargas y asegura que cada persona ejecute su plan como fue diseñado, tanto de entrenamiento como de readaptación deportiva.',
    specialties: ['Fuerza y velocidad', 'Deportes de equipo', 'Entrenamiento en sala'],
    photo: {
      src: '/img/equipo/leandro-olenchuk.jpg',
      alt: 'Leandro Olenchuk, entrenador en MOVE®',
    },
  },
];

import { Armchair, Flame, Footprints, Sun, Wind, type LucideIcon } from 'lucide-react';

export interface RecoveryEquipment {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const RECOVERY_ROOM_TEXT =
  'Un concepto nuevo en Uruguay: un espacio diseñado para optimizar la recuperación física y mental, combinando distintas tecnologías y estrategias basadas en evidencia para ayudar al cuerpo a recuperarse mejor. Cada herramienta actúa sobre un mecanismo diferente; juntas crean el entorno ideal para favorecer la recuperación, disminuir la fatiga, regular el sistema nervioso y ayudarte a sentirte y rendir mejor.';

export const RECOVERY_ROOM_PHOTOS: readonly { src: string; alt: string }[] = [
  {
    src: '/img/recovery/recovery-zero-gravity-chair.jpg',
    alt: 'Sillón de gravedad cero del Recovery Room by MOVE',
  },
  {
    src: '/img/recovery/recovery-sauna-infrarrojo.jpg',
    alt: 'Sauna infrarrojo del Recovery Room by MOVE',
  },
  {
    src: '/img/recovery/recovery-luz-roja-panel.jpg',
    alt: 'Panel de luz roja e infrarroja del Recovery Room by MOVE',
  },
];

export const RECOVERY_EQUIPMENT: readonly RecoveryEquipment[] = [
  {
    title: 'Botas de presoterapia',
    description: 'Compresión secuencial que favorece el retorno venoso y linfático y reduce la sensación de piernas cargadas.',
    icon: Footprints,
  },
  {
    title: 'Luz roja e infrarroja',
    description: 'Fotobiomodulación para acompañar la recuperación muscular y celular.',
    icon: Sun,
  },
  {
    title: 'Sauna infrarrojo',
    description: 'Calor infrarrojo que ayuda a relajar la musculatura y a la termorregulación.',
    icon: Flame,
  },
  {
    title: 'Meditación y respiración',
    description: 'Prácticas guiadas para bajar revoluciones y regular el sistema nervioso.',
    icon: Wind,
  },
  {
    title: 'Sillón de gravedad cero',
    description: 'Posición que descarga la columna y las piernas para un descanso profundo.',
    icon: Armchair,
  },
];

import { aNePasManquer, type Acteur } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';

export const aNePasManquerDe = (base: App.Locals['base'], acteur: Acteur) => aNePasManquer(base, acteur, aujourdhuiParis(), maintenantParis());

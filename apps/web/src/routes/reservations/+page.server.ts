import { ressourcesDe } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { exigerConnecte } from '#lib/server/reservations.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ressourcesDe(locals.base, exigerConnecte(locals), aujourdhuiParis());

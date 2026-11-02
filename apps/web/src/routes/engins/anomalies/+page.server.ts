import { listerAnomalies } from '@gyro-caserne/socle';
import { accesEngins, idDe } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// Les anomalies des engins : les ouvertes d'abord, par engin ; `?engin=` : celles d'un engin.
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base, aujourdhui } = await accesEngins(locals);
	const enginId = idDe(url.searchParams.get('engin')) || null;
	return { ...(await listerAnomalies(base, acteur, aujourdhui, enginId)), enginId };
};

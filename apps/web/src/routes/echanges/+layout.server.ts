import { aNePasManquer, mursDe } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { LayoutServerLoad } from './$types';

// La liste des murs de la personne, avec le nombre de nouveautés depuis sa dernière visite.
export const load: LayoutServerLoad = async ({ locals }) => {
	const acteur = exigerActeur(locals);
	const aujourdhui = aujourdhuiParis();
	const [murs, { nouveautes }] = await Promise.all([mursDe(locals.base, acteur, aujourdhui), aNePasManquer(locals.base, acteur, aujourdhui, maintenantParis())]);
	return {
		murs: murs.map((m) => ({ cle: m.cle, nom: m.nom, type: m.type, lectureSeule: m.lectureSeule, nouveautes: nouveautes.find((n) => n.cle === m.cle)?.nombre ?? 0 }))
	};
};

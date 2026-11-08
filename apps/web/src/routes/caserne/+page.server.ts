import { redirect } from '@sveltejs/kit';
import { ceQueJePeuxAttribuer, ouvreQuiFaitQuoi, listerAnomalies, listerEngins, titulairesDesMiens, voitLesEngins, vueEffectif } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { aPourvoir, avecTitulaires } from '#lib/nominations.ts';
import type { PageServerLoad } from './$types';

// Les droits (Nominations, Réglages) viennent du layout. Ici, des chiffres utiles : l'effectif, les engins, et, pour qui peut nommer, les rôles à pourvoir (comme sur Nominations).
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	const [groupes, roles, voitEngins, comites] = await Promise.all([vueEffectif(base, aujourdhui), ceQueJePeuxAttribuer(base, acteur, aujourdhui), voitLesEngins(base, acteur, aujourdhui), ouvreQuiFaitQuoi(base, acteur)]);
	// Les engins présents au centre (les partis ne comptent pas) ; null pour qui ne les voit pas.
	// Et les anomalies ouvertes.
	const [liste, anomalies] = voitEngins ? await Promise.all([listerEngins(base, acteur, aujourdhui), listerAnomalies(base, acteur, aujourdhui, null)]) : [null, null];
	return {
		engins: liste ? liste.engins.filter((e) => e.situation !== 'parti').length : null,
		anomalies: anomalies ? anomalies.ouvertes.length : null,
		// « Comités et référents » : pas pour le compte de la réserve citoyenne, qui y serait refusé.
		comites,
		agents: groupes.filter((g) => g.cle !== 'exterieurs').reduce((n, g) => n + g.personnes.length, 0),
		aPourvoir: roles.length === 0 ? null : aPourvoir(avecTitulaires(roles, await titulairesDesMiens(base, acteur, aujourdhui)))
	};
};

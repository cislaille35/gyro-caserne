import { redirect } from '@sveltejs/kit';
import { ceQueJePeuxAttribuer, titulairesDesMiens, vueEffectif } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { aPourvoir, avecTitulaires } from '#lib/nominations.ts';
import type { PageServerLoad } from './$types';

// Les droits (Nominations, Réglages) viennent du layout. Ici, des chiffres utiles : l'effectif, et, pour qui peut nommer, les rôles à pourvoir (comme sur Nominations).
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	const [groupes, roles] = await Promise.all([vueEffectif(base, aujourdhui), ceQueJePeuxAttribuer(base, acteur, aujourdhui)]);
	return {
		agents: groupes.filter((g) => g.cle !== 'exterieurs').reduce((n, g) => n + g.personnes.length, 0),
		aPourvoir: roles.length === 0 ? null : aPourvoir(avecTitulaires(roles, await titulairesDesMiens(base, acteur, aujourdhui)))
	};
};

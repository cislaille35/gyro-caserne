import { redirect } from '@sveltejs/kit';
import { aDecider, RefusDroit, vueEffectif } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { PageServerLoad } from './$types';

// Les droits (Nominations, Réglages) viennent du layout. Ici, des chiffres utiles : l'effectif, et ce qui est à pourvoir pour qui décide.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	const [groupes, decider] = await Promise.all([
		vueEffectif(base, aujourdhui),
		aDecider(base, acteur, aujourdhui).catch((erreur) => {
			if (erreur instanceof RefusDroit) return null;
			throw erreur;
		})
	]);
	return {
		agents: groupes.filter((g) => g.cle !== 'exterieurs').reduce((n, g) => n + g.personnes.length, 0),
		aPourvoir: decider === null ? null : decider.filter((d) => d.lien === '/nominations').length
	};
};

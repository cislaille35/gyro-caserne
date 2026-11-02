import { error } from '@sveltejs/kit';
import centre from '$centre';
import { aLeDroit, DonneeInvalide, historiquePrises, lireEngin, lireFiche, lirePrise } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { accesEngins, idDe } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// Un engin : son état (avec ses anomalies ouvertes), sa situation, sa prise de garde (relève en cours, écarts ouverts, historique) et la fiche de son type.
export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, base, aujourdhui } = await accesEngins(locals);
	try {
		const { engin, gere } = await lireEngin(base, acteur, idDe(params.id), aujourdhui);
		const [fiche, vue, historique, signaler] = await Promise.all([
			lireFiche(base, engin.typeId),
			lirePrise(base, acteur, engin.id, maintenantParis(), centre.astreinte),
			historiquePrises(base, engin.id),
			aLeDroit(base, acteur, 'SIGNALER_ANOMALIE', { type: 'centre' }, aujourdhui)
		]);
		const p = vue.prise;
		return {
			engin,
			gere,
			fiche,
			releve: vue.releve,
			peutFaire: vue.peutFaire,
			prise: p && { etat: p.etat, valideeLe: p.valideeLe, equipe: vue.releve.equipe?.nom ?? null, par: p.modifieePar },
			ouvertes: vue.ouvertes,
			historique,
			peutSignaler: signaler && acteur.type === 'personne' && engin.situation !== 'parti'
		};
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cet engin n’existe pas.');
		throw erreur;
	}
};

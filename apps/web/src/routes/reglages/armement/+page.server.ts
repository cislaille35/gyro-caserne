import { error } from '@sveltejs/kit';
import { enregistrerArmement, lireArmement, listerAptitudes, NIVEAUX, POSTES, type ReglageArmement } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { accesReglages, echec, numero, texte } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { listes, base } = await accesReglages(locals, aujourdhuiParis());
	if (!listes) error(403, 'Accès réservé à qui gère les listes du centre');
	const [armement, aptitudes] = await Promise.all([lireArmement(base), listerAptitudes(base)]);
	return { armement, aptitudes };
};

export const actions: Actions = {
	// Champs : « <engin>-<poste> » (nombre) et « niveau-<niveau> » (aptitude, vide pour aucune).
	enregistrer: async ({ locals, request }) => {
		const { acteur, base } = await accesReglages(locals, aujourdhuiParis());
		const f = await request.formData();
		const actuel = await lireArmement(base);
		const voulu: ReglageArmement = {
			engins: actuel.engins.map((e) => ({ nom: e.nom, postes: Object.fromEntries(POSTES.map((p) => [p, numero(texte(f, `${e.nom}-${p}`)) ?? -1])) as ReglageArmement['engins'][number]['postes'] })),
			niveaux: Object.fromEntries(NIVEAUX.map((n) => [n, numero(texte(f, `niveau-${n}`))])) as ReglageArmement['niveaux']
		};
		try {
			await enregistrerArmement(base, acteur, voulu, maintenantParis());
		} catch (erreur) {
			return echec(erreur, 'armement');
		}
		return { cible: 'armement', succes: 'Règles d’armement enregistrées.' };
	}
};

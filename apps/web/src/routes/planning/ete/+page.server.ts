import centre from '$centre';
import { ajusterPlage, eteAPreparer, proposerEte, publierEte, reglerEte, relancerEte } from '@gyro-caserne/socle';
import { etapeEteDe } from '#lib/planning/ete.ts';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { champ, echecPlanning } from '#lib/server/formulaire-planning.ts';
import { anneeDe, connecte, ouRefus } from '#lib/server/planning.ts';
import type { Actions, PageServerLoad } from './$types';

// L'été de l'année (?annee=), à l'étape ?etape= ; ?plage= ouvre une plage pour y ajouter ou retirer un agent ;
// ?panneau= ouvre la période ou la confirmation de « Recalculer ».
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = connecte(locals);
	const annee = anneeDe(url);
	const ete = await ouRefus(eteAPreparer(base, acteur, annee, maintenantParis(), centre.astreinte, url.searchParams.get('plage')), 'L’été est réservé à qui gère le planning du centre.');
	const panneau = url.searchParams.get('panneau');
	return { ete, etape: etapeEteDe(url, ete), panneau: panneau === 'periode' || panneau === 'recalculer' ? panneau : null };
};

async function agir(locals: App.Locals, cible: string, succes: string, faire: (m: string) => Promise<unknown>) {
	connecte(locals);
	try {
		await faire(maintenantParis());
	} catch (erreur) {
		return echecPlanning(erreur, cible);
	}
	return { cible, succes };
}

export const actions: Actions = {
	regler: async ({ locals, request, url }) => {
		const f = await request.formData();
		const d = { debut: champ(f, 'debut'), fin: champ(f, 'fin'), dateLimite: champ(f, 'dateLimite') };
		return agir(locals, 'regler', 'Été enregistré : les agents peuvent donner leurs vacances.', (m) => reglerEte(locals.base, locals.acteur!, anneeDe(url), d, m, centre.astreinte));
	},
	proposer: async ({ locals, url }) => {
		connecte(locals);
		try {
			const { impossibles } = await proposerEte(locals.base, locals.acteur!, anneeDe(url), maintenantParis(), centre.astreinte);
			const n = impossibles.length;
			return { cible: 'repartition', succes: n === 0 ? 'Répartition proposée : le FPT est armé sur chaque plage.' : `Répartition proposée ; ${n === 1 ? 'une plage reste impossible' : `${n} plages restent impossibles`}.` };
		} catch (erreur) {
			return echecPlanning(erreur, 'repartition');
		}
	},
	ajuster: async ({ locals, request, url }) => {
		const f = await request.formData();
		const present = champ(f, 'present') === 'oui';
		return agir(locals, 'plage', present ? 'Agent ajouté.' : 'Agent retiré.', (m) => ajusterPlage(locals.base, locals.acteur!, anneeDe(url), champ(f, 'debut'), Number(champ(f, 'personne')), present, m, centre.astreinte));
	},
	relancer: async ({ locals, url }) => {
		connecte(locals);
		try {
			const n = await relancerEte(locals.base, locals.acteur!, anneeDe(url), maintenantParis());
			return { cible: 'relancer', succes: n === 1 ? 'Rappel envoyé à l’agent sans réponse.' : `Rappel envoyé aux ${n} agents sans réponse.` };
		} catch (erreur) {
			return echecPlanning(erreur, 'relancer');
		}
	},
	publier: async ({ locals, url }) => agir(locals, 'publier', 'L’été est publié : le planning de chacun le suit.', (m) => publierEte(locals.base, locals.acteur!, anneeDe(url), m, centre.astreinte))
};

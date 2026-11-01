import { fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { demanderRemplacement, pourDemander, proposerEchange, type PeriodePlanning } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { ouRefus } from '#lib/server/planning.ts';
import { exigerConnecte, refus } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

const entier = (brut: string | null) => (brut !== null && /^\d{1,9}$/.test(brut) ? Number(brut) : null);

// « Me faire remplacer » (?mode=remplacement) ou « Échanger » (?mode=echange&avec=<id>) : mes tranches, et celles du collègue.
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerConnecte(locals);
	if (acteur.type !== 'personne') redirect(303, '/remplacements');
	const mode = url.searchParams.get('mode') === 'echange' ? 'echange' : 'remplacement';
	const lu = await ouRefus(pourDemander(locals.base, acteur, maintenantParis(), centre.astreinte, mode === 'echange' ? entier(url.searchParams.get('avec')) : null), 'Réservé aux agents du centre.');
	return { mode, ...lu };
};

// « debut|fin » → une période.
const periode = (brut: FormDataEntryValue): PeriodePlanning | null => {
	const [debut, fin] = String(brut).split('|');
	return debut && fin ? { debut, fin } : null;
};

// Les tranches cochées, et celles des blocs « tout le week-end » cochés.
function cochees(formulaire: FormData, nom: string, tranches: PeriodePlanning[]): PeriodePlanning[] {
	const seules = formulaire.getAll(nom).map(periode).filter((p) => p !== null);
	const blocs = formulaire.getAll(`${nom}-bloc`).map(periode).filter((p) => p !== null);
	const dansUnBloc = tranches.filter((t) => blocs.some((b) => b.debut <= t.debut && t.fin <= b.fin));
	return [...new Map([...seules, ...dansUnBloc].map((p) => [`${p.debut}|${p.fin}`, p])).values()];
}

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const formulaire = await request.formData();
		const maintenant = maintenantParis();
		const echange = formulaire.get('mode') === 'echange';
		const collegue = entier(typeof formulaire.get('collegue') === 'string' ? (formulaire.get('collegue') as string) : null);
		const lu = await pourDemander(locals.base, acteur, maintenant, centre.astreinte, echange ? collegue : null);
		const periodes = cochees(formulaire, 'periode', lu.semaines.flatMap((s) => s.tranches));
		const mot = typeof formulaire.get('mot') === 'string' ? (formulaire.get('mot') as string) : null;
		if (periodes.length === 0) return fail(400, { message: 'Cochez au moins une de vos périodes.' });
		let id: number;
		try {
			if (echange) {
				if (collegue === null || lu.avec === null) return fail(400, { message: 'Choisissez le collègue avec qui échanger.' });
				const periodesCible = cochees(formulaire, 'periodeCible', lu.semainesAvec.flatMap((s) => s.tranches));
				if (periodesCible.length === 0) return fail(400, { message: 'Cochez au moins une période de votre collègue.' });
				id = await proposerEchange(locals.base, acteur, { periodes, cibleId: collegue, periodesCible, mot }, maintenant, centre.astreinte);
			} else {
				const cible = formulaire.get('pour') === 'collegue' ? collegue : null;
				if (formulaire.get('pour') === 'collegue' && cible === null) return fail(400, { message: 'Choisissez le collègue.' });
				id = await demanderRemplacement(locals.base, acteur, { periodes, cibleId: cible, mot }, maintenant, centre.astreinte);
			}
		} catch (erreur) {
			return refus(erreur);
		}
		redirect(303, `/remplacements/${id}`);
	}
};

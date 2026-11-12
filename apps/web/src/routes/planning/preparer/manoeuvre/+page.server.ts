import centre from '$centre';
import { redirect } from '@sveltejs/kit';
import { enregistrerManoeuvre, manoeuvreAPreparer, manoeuvreChangee, supprimerManoeuvre } from '@gyro-caserne/socle';
import { enArrierePlan } from '#lib/server/notifier.ts';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { champ, echecPlanning, nombres } from '#lib/server/formulaire-planning.ts';
import { annoncerSiJournee, connecte, ouRefus } from '#lib/server/planning.ts';
import type { Actions, PageServerLoad } from './$types';

// Nouvelle manœuvre, ou celle de ?id=.
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = connecte(locals);
	const brut = url.searchParams.get('id');
	const id = brut && /^\d+$/.test(brut) ? Number(brut) : null;
	const { manoeuvre, equipes } = await ouRefus(manoeuvreAPreparer(base, acteur, id, maintenantParis()), 'Les manœuvres sont réservées à qui gère le planning du centre.');
	return { manoeuvre, equipes, annee: url.searchParams.get('annee') ?? maintenantParis().slice(0, 4) };
};

export const actions: Actions = {
	enregistrer: async ({ locals, request }) => {
		const { acteur, base } = connecte(locals);
		const f = await request.formData();
		const valeurs = { id: champ(f, 'id'), date: champ(f, 'date'), heure: champ(f, 'heure'), fin: champ(f, 'fin'), theme: champ(f, 'theme'), lieu: champ(f, 'lieu'), pour: champ(f, 'pour'), petitDejeuner: champ(f, 'petitDejeuner'), equipes: f.getAll('equipes').map(String) };
		let id: number;
		try {
			id = await enregistrerManoeuvre(
				base,
				acteur,
				{
					id: /^\d+$/.test(valeurs.id) ? Number(valeurs.id) : undefined,
					debut: `${valeurs.date}T${valeurs.heure}`,
					fin: valeurs.fin ? `${valeurs.date}T${valeurs.fin}` : null,
					theme: valeurs.theme,
					lieu: valeurs.lieu,
					convoques: valeurs.pour === 'tous' ? 'tous' : nombres(f, 'equipes'),
					petitDejeuner: valeurs.petitDejeuner === 'oui'
				},
				maintenantParis(),
				centre.manoeuvres.petitDejeuner
			);
		} catch (erreur) {
			return echecPlanning(erreur, 'manoeuvre', valeurs);
		}
		// Déjà annoncée : les convoqués sont prévenus du changement, après la réponse. Sinon, annoncée tout de suite si elle est proche.
		if (valeurs.id) enArrierePlan(locals, () => manoeuvreChangee(base, id, maintenantParis()));
		annoncerSiJournee(locals);
		redirect(303, `/planning/preparer?annee=${valeurs.date.slice(0, 4)}&etape=manoeuvres`);
	},
	supprimer: async ({ locals, request }) => {
		const { acteur, base } = connecte(locals);
		const f = await request.formData();
		const id = Number(champ(f, 'id'));
		let annee = maintenantParis().slice(0, 4);
		try {
			annee = (await manoeuvreAPreparer(base, acteur, id, maintenantParis())).manoeuvre!.debut.slice(0, 4);
			await supprimerManoeuvre(base, acteur, id, maintenantParis());
		} catch (erreur) {
			return echecPlanning(erreur, 'supprimer');
		}
		enArrierePlan(locals, () => manoeuvreChangee(base, id, maintenantParis()));
		redirect(303, `/planning/preparer?annee=${annee}&etape=manoeuvres`);
	}
};

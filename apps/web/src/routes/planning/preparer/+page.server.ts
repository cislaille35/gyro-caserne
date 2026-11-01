import centre from '$centre';
import { ajouterVacances, changerSemaines, noterFete, preparerAnnee, publierAnnee, reglerRoulement, retirerVacances } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { champ, echecPlanning, nombres } from '#lib/server/formulaire-planning.ts';
import { annoncerSiJournee, anneeDe, connecte, ouRefus } from '#lib/server/planning.ts';
import type { Actions, PageServerLoad } from './$types';

const REFUS = 'Préparer l’année est réservé à qui gère le planning du centre.';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = connecte(locals);
	const annee = anneeDe(url);
	const preparation = await ouRefus(preparerAnnee(base, acteur, annee, maintenantParis(), centre.astreinte), REFUS);
	const courante = Number(maintenantParis().slice(0, 4));
	return { preparation, annees: [courante, courante + 1] };
};

// Chaque action : l'année visée dans l'adresse (?annee=), une réponse pour son formulaire.
async function agir(locals: App.Locals, cible: string, succes: string, faire: (m: string) => Promise<unknown>, valeurs?: Record<string, string>) {
	connecte(locals);
	try {
		await faire(maintenantParis());
	} catch (erreur) {
		return echecPlanning(erreur, cible, valeurs);
	}
	return { cible, succes };
}

export const actions: Actions = {
	roulement: async ({ locals, request, url }) => {
		const ordre = nombres(await request.formData(), 'ordre');
		return agir(locals, 'roulement', 'Roulement enregistré.', (m) => reglerRoulement(locals.base, locals.acteur!, anneeDe(url), ordre, m));
	},
	semaines: async ({ locals, request, url }) => {
		const choix: Record<string, number> = {};
		for (const [cle, valeur] of await request.formData()) {
			const debut = /^semaine-(\d{4}-\d{2}-\d{2})$/.exec(cle)?.[1];
			if (debut && typeof valeur === 'string' && /^\d+$/.test(valeur)) choix[debut] = Number(valeur);
		}
		return agir(locals, 'semaines', 'Semaines enregistrées.', (m) => changerSemaines(locals.base, locals.acteur!, anneeDe(url), choix, m, centre.astreinte));
	},
	fete: async ({ locals, request }) => {
		const f = await request.formData();
		const equipe = champ(f, 'equipe');
		const fete = champ(f, 'fete') === 'nouvel_an' ? 'nouvel_an' : 'noel';
		return agir(locals, 'fetes', equipe ? 'Historique enregistré.' : 'Ligne retirée.', (m) => noterFete(locals.base, locals.acteur!, Number(champ(f, 'annee')), fete, equipe ? Number(equipe) : null, m));
	},
	vacances: async ({ locals, request }) => {
		const f = await request.formData();
		const valeurs = { nom: champ(f, 'nom'), debut: champ(f, 'debut'), fin: champ(f, 'fin') };
		return agir(locals, 'vacances', 'Vacances ajoutées.', (m) => ajouterVacances(locals.base, locals.acteur!, valeurs, m), valeurs);
	},
	retirerVacances: async ({ locals, request }) => {
		const id = Number(champ(await request.formData(), 'id'));
		return agir(locals, 'vacances', 'Vacances retirées.', (m) => retirerVacances(locals.base, locals.acteur!, id, m));
	},
	publier: async ({ locals, url }) => {
		const reponse = await agir(locals, 'publier', 'L’année est publiée : tous les agents la voient.', (m) => publierAnnee(locals.base, locals.acteur!, anneeDe(url), m));
		// Les manœuvres des deux prochaines semaines sont annoncées sans attendre le matin.
		if ('succes' in reponse) annoncerSiJournee(locals);
		return reponse;
	}
};

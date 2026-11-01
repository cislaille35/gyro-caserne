import centre from '$centre';
import { ajouterVacances, calculerAnnee, changerSemaines, noterFete, preparerAnnee, publierAnnee, reglerRoulement, retirerVacances } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { deplacer, etapeDe } from '#lib/planning/preparer.ts';
import { champ, echecPlanning, nombres } from '#lib/server/formulaire-planning.ts';
import { annoncerSiJournee, anneeDe, connecte, ouRefus } from '#lib/server/planning.ts';
import type { Actions, PageServerLoad } from './$types';

const REFUS = 'Préparer l’année est réservé à qui gère le planning du centre.';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = connecte(locals);
	const annee = anneeDe(url);
	const preparation = await ouRefus(preparerAnnee(base, acteur, annee, maintenantParis(), centre.astreinte), REFUS);
	const courante = Number(maintenantParis().slice(0, 4));
	// Avant le premier enregistrement, l'aperçu suit l'ordre proposé.
	const ordre = preparation.ordre.length ? preparation.ordre : preparation.ordrePropose;
	const apercu = (preparation.semaines.length ? preparation.semaines : calculerAnnee(annee, centre.astreinte, ordre, new Map())).slice(0, 6);
	const nombre = (cle: string) => (/^\d+$/.test(url.searchParams.get(cle) ?? '') ? Number(url.searchParams.get(cle)) : null);
	return {
		preparation,
		annees: [courante, courante + 1],
		etape: etapeDe(url),
		apercu,
		// Le panneau ouvert : une manœuvre (« nouvelle » ou son numéro), une semaine, ou l'échange proposé pour une fête.
		manoeuvre: url.searchParams.get('manoeuvre') === 'nouvelle' ? ('nouvelle' as const) : nombre('manoeuvre'),
		semaine: preparation.semaines.find((x) => x.debut === url.searchParams.get('semaine'))?.debut ?? null,
		proposer: url.searchParams.get('proposer') === 'noel' ? ('noel' as const) : url.searchParams.get('proposer') === 'nouvel_an' ? ('nouvel_an' as const) : null
	};
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
	// Monter ou descendre une équipe : l'ordre est enregistré tout de suite.
	deplacer: async ({ locals, request, url }) => {
		const f = await request.formData();
		const [rang, sens] = champ(f, 'deplacer').split(':');
		const ordre = deplacer(nombres(f, 'ordre'), Number(rang), sens === 'monter' ? -1 : 1);
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

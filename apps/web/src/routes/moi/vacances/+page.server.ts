import { fail, redirect } from '@sveltejs/kit';
import { ajouterMesVacances, DonneeInvalide, mesVacances, retirerMesVacances, toutLete } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { champ } from '#lib/server/formulaire-planning.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	if (acteur.type !== 'personne') return { vacances: null };
	return { vacances: await mesVacances(base, acteur, maintenantParis()) };
};

const MESSAGES: Record<string, string> = {
	'Fin avant le début': 'La fin est avant le début.',
	'Hors de l’été': 'Ces dates sont en dehors de l’été.',
	'Chevauche une autre période': 'Ces dates chevauchent une période déjà donnée.',
	'Été pas encore ouvert': 'La saisie des vacances n’est pas encore ouverte.'
};

async function agir(locals: App.Locals, succes: string, faire: (m: string) => Promise<unknown>, valeurs?: Record<string, string>) {
	if (!locals.acteur) redirect(303, '/connexion');
	try {
		await faire(maintenantParis());
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) return fail(400, { message: MESSAGES[erreur.message] ?? (erreur.message.startsWith('Date invalide') ? 'Indiquez les deux dates.' : erreur.message), valeurs });
		throw erreur;
	}
	return { succes };
}

export const actions: Actions = {
	ajouter: async ({ locals, request }) => {
		const f = await request.formData();
		const valeurs = { debut: champ(f, 'debut'), fin: champ(f, 'fin') };
		return agir(locals, 'Période ajoutée.', (m) => ajouterMesVacances(locals.base, locals.acteur!, Number(champ(f, 'annee')), valeurs, m), valeurs);
	},
	retirer: async ({ locals, request }) => {
		const id = Number(champ(await request.formData(), 'id'));
		return agir(locals, 'Période retirée.', (m) => retirerMesVacances(locals.base, locals.acteur!, id, m));
	},
	toutLete: async ({ locals, request }) => {
		const annee = Number(champ(await request.formData(), 'annee'));
		return agir(locals, 'C’est noté : disponible tout l’été.', (m) => toutLete(locals.base, locals.acteur!, annee, m));
	}
};

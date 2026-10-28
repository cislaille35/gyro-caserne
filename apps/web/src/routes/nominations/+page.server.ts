import { error, redirect } from '@sveltejs/kit';
import { ceQueJePeuxAttribuer, titulairesDe, titulairesDesMiens, vueEffectif } from '@gyro-caserne/socle';
import { finir, nommer, terminer } from '#lib/server/actions-attribution.ts';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { Actions, PageServerLoad } from './$types';

// Ouvert à quiconque peut attribuer au moins une responsabilité ; le socle décide du reste.
async function exigerNominateur(locals: App.Locals) {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	const peutAttribuer = await ceQueJePeuxAttribuer(base, acteur, aujourdhui);
	if (peutAttribuer.length === 0) error(403, 'Accès réservé à qui peut attribuer une responsabilité');
	return { acteur, base, aujourdhui, peutAttribuer };
}

const entier = (brut: FormDataEntryValue | null) => (/^\d+$/.test(String(brut ?? '')) ? Number(brut) : null);

export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base, aujourdhui, peutAttribuer } = await exigerNominateur(locals);
	const titulaires = await titulairesDesMiens(base, acteur, aujourdhui);
	const roles = peutAttribuer.map((r) => ({ ...r, titulaires: titulaires.get(r.responsabiliteId) ?? [] }));
	// Nom et équipe seulement : pas de donnée de gestion pour un rapporteur.
	const agents = (await vueEffectif(base, aujourdhui))
		.flatMap((g) => g.personnes.map((p) => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, equipe: g.titre })))
		.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
	// Sans JavaScript, le panneau « Nommer », la confirmation « Retirer » et la recherche passent par l'adresse.
	const parametre = (cle: string) => entier(url.searchParams.get(cle));
	return { aujourdhui, roles, agents, nommer: parametre('nommer'), retirer: parametre('retirer'), recherche: url.searchParams.get('q')?.trim() ?? '' };
};

// « Terminer » et « Changer la date de fin » : seuls les titulaires affichés du rôle du formulaire (un identifiant fabriqué est refusé).
async function retrait(locals: App.Locals, request: Request) {
	const { acteur, base, aujourdhui } = await exigerNominateur(locals);
	const formulaire = await request.formData();
	const role = entier(formulaire.get('responsabiliteId')) ?? undefined;
	const estVisible = async (attributionId: number) => role !== undefined && (await titulairesDe(base, acteur, role, aujourdhui)).some((t) => t.id === attributionId);
	return { contexte: { base, acteur, aujourdhui, formulaire, role }, estVisible };
}

export const actions: Actions = {
	attribuer: async ({ locals, request }) => {
		const { acteur, base, aujourdhui } = await exigerNominateur(locals);
		const formulaire = await request.formData();
		return nommer({ base, acteur, aujourdhui, formulaire, cible: `attribuer-${String(formulaire.get('responsabiliteId') ?? '')}` }, entier(formulaire.get('personneId')));
	},

	terminer: async ({ locals, request }) => {
		const { contexte, estVisible } = await retrait(locals, request);
		return terminer(contexte, estVisible);
	},

	finir: async ({ locals, request }) => {
		const { contexte, estVisible } = await retrait(locals, request);
		return finir(contexte, estVisible);
	}
};

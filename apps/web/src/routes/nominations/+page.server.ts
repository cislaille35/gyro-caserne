import { error, redirect } from '@sveltejs/kit';
import { ceQueJePeuxAttribuer, titulairesDe, vueEffectif } from '@gyro-caserne/socle';
import { nommer, terminer } from '#lib/server/actions-attribution.ts';
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

export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base, aujourdhui, peutAttribuer } = await exigerNominateur(locals);
	const roles = [];
	for (const r of peutAttribuer) roles.push({ ...r, titulaires: await titulairesDe(base, acteur, r.responsabiliteId, aujourdhui) });
	// Nom et équipe seulement : pas de donnée de gestion pour un rapporteur.
	const agents = (await vueEffectif(base, aujourdhui))
		.flatMap((g) => g.personnes.map((p) => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, equipe: g.titre })))
		.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
	return { aujourdhui, roles, agents };
};

const entier = (brut: FormDataEntryValue | null) => (/^\d+$/.test(String(brut ?? '')) ? Number(brut) : null);

export const actions: Actions = {
	attribuer: async ({ locals, request }) => {
		const { acteur, base, aujourdhui } = await exigerNominateur(locals);
		const formulaire = await request.formData();
		return nommer({ base, acteur, aujourdhui, formulaire, cible: `attribuer-${String(formulaire.get('responsabiliteId') ?? '')}` }, entier(formulaire.get('personneId')));
	},

	terminer: async ({ locals, request }) => {
		const { acteur, base, aujourdhui } = await exigerNominateur(locals);
		const formulaire = await request.formData();
		const responsabiliteId = entier(formulaire.get('responsabiliteId'));
		// Seuls les titulaires du rôle affiché : un identifiant fabriqué est refusé.
		const estVisible = async (attributionId: number) =>
			responsabiliteId !== null && (await titulairesDe(base, acteur, responsabiliteId, aujourdhui)).some((t) => t.id === attributionId);
		return terminer({ base, acteur, aujourdhui, formulaire }, estVisible);
	}
};

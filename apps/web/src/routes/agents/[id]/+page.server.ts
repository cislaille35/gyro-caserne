import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import {
	affecterEquipe,
	attributionsDe,
	ceQueJePeuxAttribuer,
	changerStatut,
	DonneeInvalide,
	equipe,
	estChefDeCentre,
	ficheAgent,
	grade,
	modifierFiche,
	profil,
	retirerEquipe,
	STATUTS_OPERATIONNELS,
	type Acteur,
	type FicheAgent
} from '@gyro-caserne/socle';
import { finir, nommer, terminer } from '#lib/server/actions-attribution.ts';
import { echec, exigerGestion, lireFormulaire, type Reponse } from '#lib/server/formulaire-agent.ts';
import type { Actions, PageServerLoad } from './$types';

async function lireFiche(locals: App.Locals, brut: string) {
	const { acteur, aujourdhui } = await exigerGestion(locals);
	const id = /^\d+$/.test(brut) ? Number(brut) : NaN;
	try {
		if (Number.isNaN(id)) throw new DonneeInvalide('Personne inconnue');
		return { acteur, aujourdhui, id, fiche: await ficheAgent(locals.base, acteur, id, aujourdhui) };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Agent introuvable');
		throw erreur;
	}
}

// Mêmes règles que le socle : la raison s'affiche à la place des formulaires.
async function raisonDeProtection(locals: App.Locals, acteur: Acteur, fiche: FicheAgent, aujourdhui: string): Promise<string | null> {
	if (fiche.protection === null || acteur.type === 'super') return null;
	if (fiche.protection === 'chef') return 'Seul un super administrateur modifie la fiche du chef de centre.';
	if (await estChefDeCentre(locals.base, acteur.id, aujourdhui)) return null;
	return 'Seuls le chef de centre ou un super administrateur modifient la fiche d’un adjoint.';
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, aujourdhui, fiche } = await lireFiche(locals, params.id);
	const { base } = locals;
	return {
		aujourdhui,
		fiche,
		raison: await raisonDeProtection(locals, acteur, fiche, aujourdhui),
		grades: await base.select({ id: grade.id, libelle: grade.libelle }).from(grade).orderBy(asc(grade.ordre)),
		profils: await base.select({ id: profil.id, nom: profil.nom }).from(profil).orderBy(asc(profil.id)),
		equipes: await base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		statuts: [...STATUTS_OPERATIONNELS],
		attributions: await attributionsDe(base, acteur, fiche.id, aujourdhui),
		// On ne nomme pas une personne partie. Les équipes : celle de la personne d'abord, c'est le choix le plus probable.
		peutAttribuer:
			fiche.statut === 'parti'
				? []
				: (await ceQueJePeuxAttribuer(base, acteur, aujourdhui)).map((r) => ({
						...r,
						perimetres: [...r.perimetres].sort((a, b) => Number(b.id === fiche.equipe?.id && b.type === 'equipe') - Number(a.id === fiche.equipe?.id && a.type === 'equipe'))
					}))
	};
};

// Seuls les rôles en cours ou à venir de cette fiche : un identifiant d'une autre personne est refusé.
const rolesDeLaFiche = (base: App.Locals['base'], acteur: Acteur, id: number, aujourdhui: string) => async (attributionId: number) => {
	const { enCours, aVenir } = await attributionsDe(base, acteur, id, aujourdhui);
	return [...enCours, ...aVenir].some((a) => a.id === attributionId);
};

export const actions: Actions = {
	fiche: async ({ locals, params, request }) => {
		const { acteur, aujourdhui, id } = await lireFiche(locals, params.id);
		const { champs, erreurs, valeurs } = lireFormulaire(await request.formData(), locals.superAdmins);
		if (Object.keys(erreurs).length > 0) return fail<Reponse>(400, { erreurs, valeurs });
		const { equipeId: _equipe, profilId, ...autres } = champs;
		try {
			await modifierFiche(locals.base, acteur, id, { ...autres, ...(profilId != null && { profilId }) }, aujourdhui);
		} catch (erreur) {
			return echec(erreur, { valeurs });
		}
		return { succes: true, message: 'Fiche enregistrée' };
	},

	equipe: async ({ locals, params, request }) => {
		const { acteur, aujourdhui, id } = await lireFiche(locals, params.id);
		const brut = String((await request.formData()).get('equipeId') ?? '');
		if (brut !== 'aucune' && !/^\d+$/.test(brut)) return fail<Reponse>(400, { erreurs: { equipeId: 'Choix inconnu' } });
		const equipeId = brut === 'aucune' ? null : Number(brut);
		try {
			if (equipeId === null) await retirerEquipe(locals.base, acteur, id, aujourdhui);
			else await affecterEquipe(locals.base, acteur, id, equipeId, aujourdhui, aujourdhui);
		} catch (erreur) {
			if (erreur instanceof DonneeInvalide && erreur.message === 'Aucune équipe en cours') return { succes: true, message: 'Aucune équipe à retirer.' };
			return echec(erreur);
		}
		return { succes: true, message: 'Équipe enregistrée' };
	},

	statut: async ({ locals, params, request }) => {
		const { acteur, aujourdhui, id } = await lireFiche(locals, params.id);
		const formulaire = await request.formData();
		const statut = STATUTS_OPERATIONNELS.find((s) => s === formulaire.get('statut'));
		const valeurs = { statut: String(formulaire.get('statut') ?? '') };
		if (!statut) return fail<Reponse>(400, { erreurs: { statut: 'Choix inconnu' }, valeurs });
		// Le départ efface des données : rien sans confirmation explicite.
		if (statut === 'parti' && formulaire.get('confirmation') !== 'oui')
			return fail<Reponse>(400, { erreurs: { confirmation: 'Cochez « Je confirme » pour déclarer le départ.' }, valeurs });
		try {
			await changerStatut(locals.base, acteur, id, statut, aujourdhui);
		} catch (erreur) {
			return echec(erreur, { valeurs });
		}
		return { succes: true, message: 'Statut enregistré' };
	},

	attribuer: async ({ locals, params, request }) => {
		const { acteur, aujourdhui, id } = await lireFiche(locals, params.id);
		return nommer({ base: locals.base, acteur, aujourdhui, formulaire: await request.formData(), cible: 'attribuer' }, id);
	},

	terminer: async ({ locals, params, request }) => {
		const { acteur, aujourdhui, id } = await lireFiche(locals, params.id);
		return terminer({ base: locals.base, acteur, aujourdhui, formulaire: await request.formData() }, rolesDeLaFiche(locals.base, acteur, id, aujourdhui));
	},

	finir: async ({ locals, params, request }) => {
		const { acteur, aujourdhui, id } = await lireFiche(locals, params.id);
		return finir({ base: locals.base, acteur, aujourdhui, formulaire: await request.formData() }, rolesDeLaFiche(locals.base, acteur, id, aujourdhui));
	}
};

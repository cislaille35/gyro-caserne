import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import {
	affecterEquipe,
	annuaire,
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
	RefusDroit,
	retirerEquipe,
	STATUTS_OPERATIONNELS,
	type Acteur,
	type FicheAgent
} from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
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

// « Écrire » par la messagerie : si l'on y a accès, et que la personne y est (ce n'est donc pas soi).
async function peutEcrire(locals: App.Locals, acteur: Acteur, id: number, aujourdhui: string): Promise<boolean> {
	try {
		return (await annuaire(locals.base, acteur, aujourdhui)).some((a) => a.id === id);
	} catch (erreur) {
		if (erreur instanceof RefusDroit) return false;
		throw erreur;
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, aujourdhui, fiche } = await lireFiche(locals, params.id);
	const { base } = locals;
	return {
		aujourdhui,
		fiche,
		raison: await raisonDeProtection(locals, acteur, fiche, aujourdhui),
		ecrire: await peutEcrire(locals, acteur, fiche.id, aujourdhui),
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
		const { champs, erreurs, valeurs } = lireFormulaire(await request.formData());
		if (Object.keys(erreurs).length > 0) return fail<Reponse>(400, { erreurs, valeurs });
		const { equipeId: _equipe, profilId, ...autres } = champs;
		try {
			await modifierFiche(locals.base, acteur, id, { ...autres, ...(profilId != null && { profilId }) }, aujourdhui, locals.superAdmins);
		} catch (erreur) {
			return echec(erreur, { valeurs });
		}
		// Le bloc de la page reste ouvert après l'enregistrement.
		const bloc = ['prenom', 'nom', 'email', 'telephone', 'naissance'].some((c) => c in valeurs) ? 'identite' : 'parcours';
		return { succes: true, message: 'Fiche enregistrée', bloc };
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
			if (erreur instanceof DonneeInvalide && erreur.message === 'Aucune équipe en cours') return { succes: true, message: 'Aucune équipe à retirer.', bloc: 'equipe' };
			return echec(erreur, { valeurs: { equipeId: brut } });
		}
		return { succes: true, message: 'Équipe enregistrée', bloc: 'equipe' };
	},

	statut: async ({ locals, params, request }) => {
		const { acteur, id } = await lireFiche(locals, params.id);
		const formulaire = await request.formData();
		const statut = STATUTS_OPERATIONNELS.find((s) => s === formulaire.get('statut'));
		const valeurs = { statut: String(formulaire.get('statut') ?? '') };
		if (!statut) return fail<Reponse>(400, { erreurs: { statut: 'Choix inconnu' }, valeurs });
		// Le départ efface des données : rien sans confirmation explicite.
		if (statut === 'parti' && formulaire.get('confirmation') !== 'oui')
			return fail<Reponse>(400, { erreurs: { confirmation: 'Cochez « Je confirme » pour déclarer le départ.' }, valeurs });
		try {
			await changerStatut(locals.base, locals.basePhotos, acteur, id, statut, maintenantParis());
		} catch (erreur) {
			return echec(erreur, { valeurs });
		}
		return { succes: true, message: 'Statut enregistré', bloc: statut === 'parti' ? 'depart' : 'equipe' };
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

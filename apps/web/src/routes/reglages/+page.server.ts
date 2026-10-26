import { error, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import {
	aLeDroit,
	archiverResponsabilite,
	creerComite,
	creerResponsabilite,
	DonneeInvalide,
	DROITS,
	DROITS_POUVOIR,
	estDroitPouvoir,
	dissoudreComite,
	comite,
	listerComites,
	listerResponsabilites,
	modifierComite,
	modifierResponsabilite,
	type Acteur,
	type Attributeur,
	type Droit
} from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { echec, manque, type Reponse, type Valeurs } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

type Nature = 'fonction' | 'mission';
type Portee = 'centre' | 'equipe' | 'comite';
const CENTRE = { type: 'centre' } as const;

// Qui peut quoi sur le centre : comités (GERER_COMITES), responsabilités (GERER_LISTES), pouvoir (GERER_ACCES ou super).
async function droits(locals: App.Locals, aujourdhui: string) {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const [comites, listes, pouvoir] = await Promise.all([
		aLeDroit(base, acteur, 'GERER_COMITES', CENTRE, aujourdhui),
		aLeDroit(base, acteur, 'GERER_LISTES', CENTRE, aujourdhui),
		acteur.type === 'super' ? true : aLeDroit(base, acteur, 'GERER_ACCES', CENTRE, aujourdhui)
	]);
	if (!comites && !listes) error(403, 'Accès réservé à qui gère les comités ou les responsabilités du centre');
	return { acteur: acteur as Acteur, base, comites, listes, pouvoir };
}

export const load: PageServerLoad = async ({ locals }) => {
	const aujourdhui = aujourdhuiParis();
	const { acteur, base, comites, listes, pouvoir } = await droits(locals, aujourdhui);
	return {
		comites: comites ? await listerComites(base, acteur, aujourdhui) : null,
		responsabilites: listes ? await listerResponsabilites(base, acteur, aujourdhui) : null,
		// Pour choisir le comité qui attribue, même sans le droit de gérer les comités.
		comitesChoix: (await base.select({ id: comite.id, nom: comite.nom, dissousLe: comite.dissousLe }).from(comite).orderBy(asc(comite.nom))).filter((c) => c.dissousLe === null),
		// Les droits en deux groupes, pour les cases à cocher.
		droitsMetier: DROITS.filter((d) => !estDroitPouvoir(d)),
		droitsPouvoir: DROITS.filter(estDroitPouvoir),
		peutPouvoir: pouvoir
	};
};

function texte(formulaire: FormData, cle: string): string | undefined {
	const brut = formulaire.get(cle);
	return typeof brut === 'string' ? brut : undefined;
}

function identifiant(formulaire: FormData): number | null {
	const brut = texte(formulaire, 'id') ?? '';
	return /^\d+$/.test(brut) ? Number(brut) : null;
}

function attributeur(brut: string | undefined): Attributeur | null {
	if (brut === 'chef_centre' || brut === 'comite_vise') return { type: brut };
	const comite = /^comite:(\d+)$/.exec(brut ?? '');
	return comite ? { type: 'comite', id: Number(comite[1]) } : null;
}

function valeursResponsabilite(formulaire: FormData): Valeurs {
	return {
		nom: texte(formulaire, 'nom') ?? '',
		nature: texte(formulaire, 'nature'),
		portee: texte(formulaire, 'portee'),
		attributeur: texte(formulaire, 'attributeur'),
		droits: formulaire.getAll('droits').filter((d): d is string => typeof d === 'string')
	};
}

const DEMANDE_CONFIRMATION = 'Cochez « Je confirme » pour continuer.';

export const actions: Actions = {
	creerComite: async ({ locals, request }) => {
		const aujourdhui = aujourdhuiParis();
		const { acteur, base } = await droits(locals, aujourdhui);
		const formulaire = await request.formData();
		const valeurs = { nom: texte(formulaire, 'nom') ?? '', theme: texte(formulaire, 'theme') ?? '' };
		const cible = 'comite-nouveau';
		try {
			await creerComite(base, acteur, valeurs, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible, valeurs);
		}
		return { cible, succes: `Le comité « ${valeurs.nom.trim()} » est créé.` } satisfies Reponse;
	},

	modifierComite: async ({ locals, request }) => {
		const aujourdhui = aujourdhuiParis();
		const { acteur, base } = await droits(locals, aujourdhui);
		const formulaire = await request.formData();
		const id = identifiant(formulaire);
		if (id === null) return manque('comite-?', 'Comité inconnu.');
		const cible = `comite-${id}`;
		const valeurs = { nom: texte(formulaire, 'nom') ?? '', theme: texte(formulaire, 'theme') ?? '' };
		try {
			await modifierComite(base, acteur, id, valeurs, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible, valeurs);
		}
		return { cible, succes: `Le comité « ${valeurs.nom.trim()} » est modifié.` } satisfies Reponse;
	},

	dissoudreComite: async ({ locals, request }) => {
		const aujourdhui = aujourdhuiParis();
		const { acteur, base } = await droits(locals, aujourdhui);
		const formulaire = await request.formData();
		const id = identifiant(formulaire);
		if (id === null) return manque('comite-?', 'Comité inconnu.');
		const cible = `comite-${id}`;
		if (texte(formulaire, 'confirmation') !== 'oui') return manque(cible, DEMANDE_CONFIRMATION);
		try {
			await dissoudreComite(base, acteur, id, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: 'Le comité est dissous.' } satisfies Reponse;
	},

	creerResponsabilite: async ({ locals, request }) => {
		const aujourdhui = aujourdhuiParis();
		const { acteur, base } = await droits(locals, aujourdhui);
		const formulaire = await request.formData();
		const valeurs = valeursResponsabilite(formulaire);
		const cible = 'resp-nouvelle';
		const qui = attributeur(valeurs.attributeur);
		if (!qui) return echec(new DonneeInvalide('Attributeur inconnu'), cible, valeurs);
		try {
			await creerResponsabilite(base, acteur, { nom: valeurs.nom ?? '', nature: valeurs.nature as Nature, portee: valeurs.portee as Portee, attributeur: qui, droits: valeurs.droits as Droit[] }, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible, valeurs);
		}
		return { cible, succes: `La responsabilité « ${(valeurs.nom ?? '').trim()} » est créée.` } satisfies Reponse;
	},

	modifierResponsabilite: async ({ locals, request }) => {
		const aujourdhui = aujourdhuiParis();
		const { acteur, base, pouvoir } = await droits(locals, aujourdhui);
		const formulaire = await request.formData();
		const id = identifiant(formulaire);
		if (id === null) return manque('resp-?', 'Responsabilité inconnue.');
		const cible = `resp-${id}`;
		const valeurs = valeursResponsabilite(formulaire);
		const qui = attributeur(valeurs.attributeur);
		if (!qui) return echec(new DonneeInvalide('Attributeur inconnu'), cible, valeurs);
		try {
			// Une case désactivée n'est pas envoyée : on garde les droits verrouillés,
			// et les droits de pouvoir si l'acteur ne gère pas le pouvoir.
			const actuels = (await listerResponsabilites(base, acteur, aujourdhui)).find((r) => r.id === id)?.droits ?? [];
			const gardes = actuels.filter((d) => d.verrouille || (!pouvoir && (DROITS_POUVOIR as readonly Droit[]).includes(d.droit))).map((d) => d.droit);
			const droitsFinaux = [...new Set([...(valeurs.droits as Droit[]), ...gardes])];
			await modifierResponsabilite(base, acteur, id, { nom: valeurs.nom ?? '', nature: valeurs.nature as Nature, portee: valeurs.portee as Portee, attributeur: qui, droits: droitsFinaux }, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible, valeurs);
		}
		return { cible, succes: `La responsabilité « ${(valeurs.nom ?? '').trim()} » est modifiée.` } satisfies Reponse;
	},

	archiverResponsabilite: async ({ locals, request }) => {
		const aujourdhui = aujourdhuiParis();
		const { acteur, base } = await droits(locals, aujourdhui);
		const formulaire = await request.formData();
		const id = identifiant(formulaire);
		if (id === null) return manque('resp-?', 'Responsabilité inconnue.');
		const cible = `resp-${id}`;
		if (texte(formulaire, 'confirmation') !== 'oui') return manque(cible, DEMANDE_CONFIRMATION);
		try {
			await archiverResponsabilite(base, acteur, id, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: 'La responsabilité est archivée.' } satisfies Reponse;
	}
};

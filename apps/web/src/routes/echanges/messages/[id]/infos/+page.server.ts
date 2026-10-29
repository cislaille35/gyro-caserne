import { error, fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, estGestionnaire, infosConversation, nommerAnimateur, quitterGroupe, RefusDroit, renommerGroupe, retirerMembre } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { Actions, PageServerLoad } from './$types';

export type ReponseInfos = { cible: 'renommer' | 'membre' | 'quitter'; message?: string; succes?: boolean; valeurs?: { nom: string } };

const identifiant = (brut: string | null) => (brut !== null && /^\d+$/.test(brut) && Number(brut) > 0 ? Number(brut) : null);

// Les infos d'une conversation : le groupe et ses membres, ou la personne à qui l'on écrit. Membres seulement.
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const acteur = exigerActeur(locals);
	const id = identifiant(params.id);
	if (id === null) error(404, 'Conversation introuvable');
	const aujourdhui = aujourdhuiParis();
	try {
		const infos = await infosConversation(locals.base, acteur, id, aujourdhui);
		const moi = acteur.type === 'personne' ? acteur.id : 0;
		const autre = infos.type === 'deux' ? infos.membres.find((m) => m.id !== moi) : undefined;
		const q = url.searchParams;
		return {
			id,
			moiId: moi,
			infos,
			// Sans JavaScript aussi : « Renommer » et « Quitter le groupe » s'ouvrent dans la page.
			mode: infos.type === 'groupe' ? (q.has('renommer') ? ('renommer' as const) : q.has('quitter') ? ('quitter' as const) : null) : null,
			// La fiche d'un agent n'est ouverte qu'à qui gère les agents.
			fiche: autre && (await estGestionnaire(locals.base, acteur, aujourdhui)) ? `/agents/${autre.id}` : null
		};
	} catch (erreur) {
		if (erreur instanceof RefusDroit) {
			if (erreur.message === 'Conversation non accessible') error(404, 'Conversation introuvable');
			redirect(303, '/echanges?refus=messagerie');
		}
		throw erreur;
	}
};

// Les refus du socle, dits simplement.
const PHRASES: Record<string, string> = {
	'Conversation non accessible': 'Vous ne faites plus partie de ce groupe.',
	'Réservé aux animateurs du groupe': 'Seuls les animateurs du groupe peuvent faire cela.',
	'Ce n’est pas un groupe': 'Ce n’est pas un groupe.',
	'Nom du groupe vide': 'Donnez un nom au groupe.',
	'Nom du groupe trop long': 'Nom trop long : 60 caractères au plus.',
	'Pour partir, quittez le groupe': 'Pour partir, quittez le groupe.',
	'Pas membre du groupe': 'Cette personne ne fait plus partie du groupe.',
	'Membre invalide': 'Cette personne ne fait plus partie du groupe.',
	'Anime déjà le groupe': 'Cette personne anime déjà le groupe.'
};

async function agir(locals: App.Locals, brut: string, cible: ReponseInfos['cible'], geste: (id: number) => Promise<unknown>, valeurs?: ReponseInfos['valeurs']) {
	exigerActeur(locals);
	const id = identifiant(brut);
	if (id === null) error(404, 'Conversation introuvable');
	try {
		await geste(id);
	} catch (erreur) {
		if (erreur instanceof RefusDroit && PHRASES[erreur.message]) return fail<ReponseInfos>(403, { cible, message: PHRASES[erreur.message], valeurs });
		if (erreur instanceof RefusDroit) redirect(303, '/echanges?refus=messagerie');
		if (erreur instanceof DonneeInvalide) return fail<ReponseInfos>(400, { cible, message: PHRASES[erreur.message] ?? `${erreur.message}.`, valeurs });
		throw erreur;
	}
	return null;
}

const personneDe = (f: FormData) => {
	const v = f.get('personne');
	return typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : 0;
};

export const actions: Actions = {
	renommer: async ({ locals, params, request }) => {
		const nom = String((await request.formData()).get('nom') ?? '');
		const refus = await agir(locals, params.id, 'renommer', (id) => renommerGroupe(locals.base, exigerActeur(locals), id, nom, maintenantParis()), { nom });
		if (refus) return refus;
		redirect(303, `/echanges/messages/${params.id}/infos`);
	},
	nommer: async ({ locals, params, request }) => {
		const personne = personneDe(await request.formData());
		return (await agir(locals, params.id, 'membre', (id) => nommerAnimateur(locals.base, exigerActeur(locals), id, personne, maintenantParis()))) ?? { cible: 'membre' as const, succes: true };
	},
	retirer: async ({ locals, params, request }) => {
		const personne = personneDe(await request.formData());
		return (await agir(locals, params.id, 'membre', (id) => retirerMembre(locals.base, exigerActeur(locals), id, personne, maintenantParis()))) ?? { cible: 'membre' as const, succes: true };
	},
	quitter: async ({ locals, params }) => {
		const refus = await agir(locals, params.id, 'quitter', (id) => quitterGroupe(locals.base, locals.basePhotos, exigerActeur(locals), id, maintenantParis()));
		if (refus) return refus;
		redirect(303, '/echanges/messages');
	}
};

import { fail } from '@sveltejs/kit';
import { classerSignalement, DonneeInvalide, filDeNotifications, nombreAValider, RefusDroit, retirerParModeration, toutMarquerLu } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import { signalementsDe } from '#lib/server/a-faire.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerActeur(locals);
	// Le fil (publications et commentaires reçus) ; les signalements à traiter, en tête, pour qui modère.
	// Et les demandes de réservation à trancher, pour qui gère.
	const [fil, signalements, aValider] = await Promise.all([filDeNotifications(locals.base, acteur, maintenantParis()), signalementsDe(locals.base, acteur), nombreAValider(locals.base, acteur, aujourdhuiParis())]);
	// Sans JavaScript, « Retirer le message » ouvre sa confirmation dans la carte (`?retirer=<id>`).
	const brut = url.searchParams.get('retirer');
	return { ...fil, aujourdhui: aujourdhuiParis(), signalements, aValider, confirmer: brut !== null && /^\d+$/.test(brut) ? Number(brut) : null };
};

// Les refus du socle, dits simplement.
const PHRASES: Record<string, string> = {
	'Signalement introuvable ou déjà classé': 'Ce signalement a déjà été traité.',
	'Signalement invalide': 'Ce signalement est introuvable.',
	'Message déjà effacé : classez le signalement': 'Ce message n’est plus dans la conversation : classez le signalement.'
};

type Geste = typeof retirerParModeration;

async function traiter(locals: App.Locals, request: Request, geste: Geste, succes: string) {
	const acteur = exigerActeur(locals);
	const brut = (await request.formData()).get('id');
	const id = typeof brut === 'string' && /^\d+$/.test(brut) ? Number(brut) : 0;
	try {
		await geste(locals.base, locals.basePhotos, acteur, id, maintenantParis());
	} catch (erreur) {
		if (erreur instanceof RefusDroit) return fail(403, { message: 'Seule la modération peut traiter un signalement.' });
		if (erreur instanceof DonneeInvalide) return fail(400, { message: PHRASES[erreur.message] ?? `${erreur.message}.` });
		throw erreur;
	}
	return { succes };
}

export const actions: Actions = {
	toutLu: async ({ locals }) => {
		await toutMarquerLu(locals.base, exigerActeur(locals), maintenantParis());
		return { succes: 'Tout est marqué comme lu.' };
	},
	retirer: ({ locals, request }) => traiter(locals, request, retirerParModeration, 'Message retiré pour tous.'),
	classer: ({ locals, request }) => traiter(locals, request, classerSignalement, 'Signalement classé.')
};

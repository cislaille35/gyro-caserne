import { fail } from '@sveltejs/kit';
import { classerSignalement, DonneeInvalide, RefusDroit, retirerParModeration } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import { aFaire } from '#lib/a-faire.ts';
import { aNePasManquerDe, signalementsDe } from '#lib/server/a-faire.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const acteur = exigerActeur(locals);
	const [a, signalements] = await Promise.all([aNePasManquerDe(locals.base, acteur), signalementsDe(locals.base, acteur)]);
	return { ...aFaire(a), signalements };
};

// Les refus du socle, dits simplement.
const PHRASES: Record<string, string> = {
	'Signalement introuvable ou déjà classé': 'Ce signalement a déjà été traité.',
	'Signalement invalide': 'Ce signalement a déjà été traité.',
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
	retirer: ({ locals, request }) => traiter(locals, request, retirerParModeration, 'Message retiré pour tous.'),
	classer: ({ locals, request }) => traiter(locals, request, classerSignalement, 'Signalement classé.')
};

import { error, json } from '@sveltejs/kit';
import { DonneeInvalide, lireConversation, RefusDroit, suiteConversation } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import type { RequestHandler } from './$types';

const entier = (brut: string | null) => (brut !== null && /^\d+$/.test(brut) ? Number(brut) : null);
const repondre = (corps: object, status = 200) => json(corps, { status, headers: { 'cache-control': 'no-store' } });

// Le rafraîchissement d'une conversation ouverte, toutes les 4 s : ce qui a changé depuis le repère (`dernier`, `maj`).
// Avec `avant` : la page de messages plus anciens. Trois requêtes au plus. Un membre retiré reçoit 403.
export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.acteur) error(401, 'Connexion requise');
	const id = entier(params.id);
	const avant = url.searchParams.has('avant') ? entier(url.searchParams.get('avant')) : undefined;
	const dernier = entier(url.searchParams.get('dernier'));
	const maj = url.searchParams.get('maj');
	if (id === null || avant === null || (avant === undefined && (dernier === null || maj === null))) return repondre({ message: 'Repère invalide' }, 400);
	try {
		if (avant !== undefined) {
			const { messages, plusAnciens } = await lireConversation(locals.base, locals.acteur, id, { avant }, maintenantParis());
			return repondre({ messages, plusAnciens });
		}
		return repondre(await suiteConversation(locals.base, locals.acteur, id, { dernierId: dernier!, majLe: maj! }, maintenantParis()));
	} catch (erreur) {
		if (erreur instanceof RefusDroit) return repondre({ message: erreur.message === 'Conversation non accessible' ? 'Vous ne faites plus partie de ce groupe.' : 'La messagerie n’est pas ouverte à votre profil.' }, 403);
		if (erreur instanceof DonneeInvalide) return repondre({ message: erreur.message }, 400);
		throw erreur;
	}
};

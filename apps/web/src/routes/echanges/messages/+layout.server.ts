import { mesConversations, RefusDroit } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { LayoutServerLoad } from './$types';

// Dans une conversation, la liste des conversations, pour la colonne de gauche à l'ordinateur (masquée au téléphone).
const DANS_UNE_CONVERSATION = /^\/echanges\/messages\/(a\/)?\d+$/;

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	// Lire l'adresse fait relancer ce chargement à chaque navigation : la conversation quittée n'est plus comptée non lue.
	if (!DANS_UNE_CONVERSATION.test(url.pathname)) return { conversations: null };
	// Relue quand la pastille voit arriver un message.
	depends('messagerie:liste');
	try {
		return { conversations: await mesConversations(locals.base, exigerActeur(locals), maintenantParis()) };
	} catch (erreur) {
		// La page dit le refus.
		if (erreur instanceof RefusDroit) return { conversations: null };
		throw erreur;
	}
};

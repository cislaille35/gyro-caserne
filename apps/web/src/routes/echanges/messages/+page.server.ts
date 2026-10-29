import { redirect } from '@sveltejs/kit';
import { mesConversations, RefusDroit } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { PageServerLoad } from './$types';

// Mes conversations, de la plus récente à la plus ancienne. `q` : la recherche faite sans JavaScript.
export const load: PageServerLoad = async ({ locals, url, depends }) => {
	// Relue quand la pastille voit arriver un message.
	depends('messagerie:liste');
	const acteur = exigerActeur(locals);
	try {
		return {
			conversations: await mesConversations(locals.base, acteur, maintenantParis()),
			q: url.searchParams.get('q')?.trim() ?? ''
		};
	} catch (erreur) {
		if (erreur instanceof RefusDroit) redirect(303, '/echanges?refus=messagerie');
		throw erreur;
	}
};

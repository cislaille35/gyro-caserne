import { error, redirect } from '@sveltejs/kit';
import { infosConversation, lireConversation, RefusDroit, type InfosConversation } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { aPropos } from '#lib/messagerie/infos.ts';
import { actionEnvoyer, actionsDeGestes } from '#lib/server/formulaire-messagerie.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { Actions, PageServerLoad } from './$types';

const identifiant = (brut: string | null) => (brut !== null && /^\d+$/.test(brut) && Number(brut) > 0 ? Number(brut) : null);

// Sous l'en-tête : à deux, le rôle ou l'équipe de l'autre ; dans un groupe, les prénoms (cinq au plus), puis « vous ».
function sousTitre(infos: InfosConversation, moi: number): string {
	const autres = infos.membres.filter((m) => m.id !== moi);
	if (infos.type === 'deux') {
		const autre = autres[0];
		return autre?.role ?? (autre?.equipe ? `Équipe ${autre.equipe.numero}` : '');
	}
	const prenoms = autres.map((m) => m.prenom).sort((a, b) => a.localeCompare(b, 'fr'));
	const debut = prenoms.length > 6 ? `${prenoms.slice(0, 5).join(', ')} et ${prenoms.length - 5} autres` : prenoms.join(', ');
	return debut ? `${debut}, vous` : 'Vous seul';
}

// Une conversation : la dernière page de messages (marquée lue), ou une page plus ancienne avec `?avant=`. Membres seulement.
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const acteur = exigerActeur(locals);
	const id = identifiant(params.id);
	const brut = url.searchParams.get('avant');
	const avant = brut === null ? null : identifiant(brut);
	if (id === null || (brut !== null && avant === null)) error(404, 'Conversation introuvable');
	try {
		const [vue, infos] = await Promise.all([lireConversation(locals.base, acteur, id, avant === null ? {} : { avant }, maintenantParis()), infosConversation(locals.base, acteur, id, aujourdhuiParis())]);
		const moi = acteur.type === 'personne' ? acteur.id : 0;
		return {
			vue,
			moiId: moi,
			sousTitre: sousTitre(infos, moi),
			avant,
			// Pour une conversation à deux en lecture seule : « Manon n'est plus dans l'annuaire ».
			autrePrenom: vue.type === 'deux' ? (vue.membres.find((m) => m.id !== moi)?.prenom ?? null) : null,
			// « Répondre en privé » depuis un mur.
			prerempli: aPropos(url.searchParams.get('apropos')?.slice(0, 200) ?? null)
		};
	} catch (erreur) {
		if (erreur instanceof RefusDroit) {
			if (erreur.message === 'Conversation non accessible') error(404, 'Conversation introuvable');
			redirect(303, '/echanges?refus=messagerie');
		}
		throw erreur;
	}
};

export const actions: Actions = {
	envoyer: ({ locals, params, request }) => {
		const id = identifiant(params.id);
		if (id === null) error(404, 'Conversation introuvable');
		return actionEnvoyer(locals, request, { conversation: id });
	},
	...actionsDeGestes
};

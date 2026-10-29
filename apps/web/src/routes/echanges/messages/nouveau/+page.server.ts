import { redirect } from '@sveltejs/kit';
import { annuaire, mesConversations, pourVous, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { PageServerLoad } from './$types';

// À qui écrire : les raccourcis « Pour vous », puis tout le centre. `q` : la recherche faite sans JavaScript.
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerActeur(locals);
	const aujourdhui = aujourdhuiParis();
	try {
		const [agents, raccourcis, conversations] = await Promise.all([annuaire(locals.base, acteur, aujourdhui), pourVous(locals.base, acteur, aujourdhui), mesConversations(locals.base, acteur, maintenantParis())]);
		// Toucher une personne rouvre la conversation à deux si elle existe ; sinon, elle sera créée au premier envoi.
		const existantes = new Map(conversations.filter((c) => c.type === 'deux' && c.personne).map((c) => [c.personne!.id, c.id]));
		const personnes = agents.map((a) => ({
			id: a.id,
			prenom: a.prenom,
			nom: a.nom,
			surnom: a.surnom,
			couleur: a.equipe?.couleur ?? null,
			sous: a.role ?? (a.equipe ? `Équipe ${a.equipe.numero}` : ''),
			lien: existantes.has(a.id) ? `/echanges/messages/${existantes.get(a.id)}` : `/echanges/messages/a/${a.id}`
		}));
		return {
			personnes,
			pourVous: {
				chefs: personnes.filter((p) => raccourcis.chefs.includes(p.id)),
				equipes: raccourcis.equipes.map((e) => ({ ...e, lien: `/echanges/messages/nouveau/groupe?equipe=${e.id}` })),
				comites: raccourcis.comites.map((c) => ({ ...c, lien: `/echanges/messages/nouveau/groupe?comite=${c.id}` }))
			},
			q: url.searchParams.get('q')?.trim() ?? ''
		};
	} catch (erreur) {
		if (erreur instanceof RefusDroit) redirect(303, '/echanges?refus=messagerie');
		throw erreur;
	}
};

import { redirect } from '@sveltejs/kit';
import { vueEffectif } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { Actions, PageServerLoad } from './$types';

// La carte d'identité : nom, grade, premier rôle, équipe et sa couleur, lus dans l'effectif. Le super administrateur n'a pas de fiche.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	if (acteur.type === 'super') return { identite: null };
	for (const g of await vueEffectif(base, aujourdhuiParis())) {
		const p = g.personnes.find((x) => x.id === acteur.id);
		if (p) return { identite: { prenom: p.prenom, nom: p.nom, grade: p.grade, role: p.roles[0] ?? null, equipe: g.equipe ? { nom: g.titre, couleur: g.equipe.couleur } : null } };
	}
	return { identite: null };
};

export const actions: Actions = {
	deconnecter: async ({ request, locals, cookies }) => {
		const { headers } = await locals.auth.api.signOut({ headers: request.headers, returnHeaders: true });
		// Better Auth demande d'effacer ses cookies : on le fait ici, la réponse étant celle de SvelteKit.
		for (const ligne of headers.getSetCookie()) cookies.delete(ligne.slice(0, ligne.indexOf('=')), { path: '/' });
		redirect(303, '/connexion');
	}
};

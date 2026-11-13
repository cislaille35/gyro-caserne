import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { aptitudesDe, desabonnerPartout, vueEffectif } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { Actions, PageServerLoad } from './$types';

// La carte d'identité : nom, grade, premier rôle, équipe et sa couleur, lus dans l'effectif. Le super administrateur n'a pas de fiche.
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	if (acteur.type === 'super') return { identite: null, aptitudes: [] };
	const [groupes, aptitudes] = await Promise.all([vueEffectif(base, aujourdhuiParis()), aptitudesDe(base, acteur, acteur.id, aujourdhuiParis())]);
	for (const g of groupes) {
		const p = g.personnes.find((x) => x.id === acteur.id);
		if (p) return { identite: { prenom: p.prenom, nom: p.nom, grade: p.grade, role: p.roles[0] ?? null, equipe: g.equipe ? { nom: g.titre, couleur: g.equipe.couleur } : null }, aptitudes };
	}
	return { identite: null, aptitudes };
};

// Ferme la session de cet appareil : Better Auth demande d'effacer ses cookies, on le fait ici, la réponse étant celle de SvelteKit.
async function sortir(request: Request, locals: App.Locals, cookies: Pick<Cookies, 'delete'>): Promise<never> {
	const { headers } = await locals.auth.api.signOut({ headers: request.headers, returnHeaders: true });
	for (const ligne of headers.getSetCookie()) cookies.delete(ligne.slice(0, ligne.indexOf('=')), { path: '/' });
	redirect(303, '/connexion');
}

export const actions: Actions = {
	deconnecter: ({ request, locals, cookies }) => sortir(request, locals, cookies),
	// Toutes ses sessions, sur tous ses appareils, et aucun ne reçoit plus ses notifications (décision 0032).
	deconnecterPartout: async ({ request, locals, cookies }) => {
		if (!locals.acteur) redirect(303, '/connexion');
		if ((await request.formData()).get('confirmation') !== 'oui') return fail(400, { message: 'Cochez « Je confirme » pour continuer.' });
		await locals.auth.api.revokeSessions({ headers: request.headers });
		await desabonnerPartout(locals.base, locals.acteur);
		return sortir(request, locals, cookies);
	}
};

import { redirect } from '@sveltejs/kit';
import { accueilDe, prenomDe } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { aNePasManquerDe } from '#lib/server/a-faire.ts';
import { gestes } from '#lib/server/gestes-mur.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const [accueil, prenom, aNePasManquer] = await Promise.all([
		accueilDe(base, acteur, url.searchParams.get('casquette'), aujourdhuiParis()),
		prenomDe(base, acteur),
		aNePasManquerDe(base, acteur)
	]);
	return { prenom, ...accueil, aNePasManquer };
};

// « À ne pas manquer » : prise de connaissance et réponse à un événement sur place. Le socle vérifie les droits.
export const actions: Actions = {
	prendreConnaissance: ({ locals, request }) => gestes.prendreConnaissance({ locals, params: {}, request }),
	repondre: ({ locals, request }) => gestes.repondre({ locals, params: {}, request })
};

import { redirect } from '@sveltejs/kit';
import { accueilDe, prenomDe } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const accueil = await accueilDe(base, acteur, url.searchParams.get('casquette'), aujourdhuiParis());
	return { prenom: await prenomDe(base, acteur), ...accueil };
};

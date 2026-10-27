import { redirect } from '@sveltejs/kit';
import { casquettesDe, contenuCasquette, prenomDe } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	const casquettes = await casquettesDe(base, acteur, aujourdhui);
	// La demandée si elle est tenue ; sinon celle où quelque chose attend ; sinon la principale (la première).
	const demandee = url.searchParams.get('casquette');
	const choisie = (casquettes.find((c) => c.id === demandee) ?? casquettes.find((c) => c.compte > 0) ?? casquettes[0]!).id;
	return {
		prenom: await prenomDe(base, acteur),
		casquettes,
		choisie,
		contenu: (await contenuCasquette(base, acteur, choisie, aujourdhui))!
	};
};

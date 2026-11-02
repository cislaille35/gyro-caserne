import { error } from '@sveltejs/kit';
import { DonneeInvalide, lireEngin, lireFiche } from '@gyro-caserne/socle';
import { accesEngins, idDe } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// Un engin : son état, sa situation et la fiche de son type (dernière version).
export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, base, aujourdhui } = await accesEngins(locals);
	try {
		const { engin, gere } = await lireEngin(base, acteur, idDe(params.id), aujourdhui);
		return { engin, gere, fiche: await lireFiche(base, engin.typeId) };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cet engin n’existe pas.');
		throw erreur;
	}
};

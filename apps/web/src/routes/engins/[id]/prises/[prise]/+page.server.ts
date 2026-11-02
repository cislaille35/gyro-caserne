import { error } from '@sveltejs/kit';
import { DonneeInvalide, lirePriseFaite } from '@gyro-caserne/socle';
import { accesEngins, idDe } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// Une prise validée, telle qu'elle a été faite (la fiche de son époque).
export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, base } = await accesEngins(locals);
	try {
		const prise = await lirePriseFaite(base, acteur, idDe(params.prise));
		if (prise.engin.id !== idDe(params.id)) error(404, 'Cette prise n’existe pas.');
		return { prise };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cette prise n’existe pas.');
		throw erreur;
	}
};

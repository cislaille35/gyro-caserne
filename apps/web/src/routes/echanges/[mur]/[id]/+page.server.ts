import { error } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { equipe, lirePublication, suiviPublication } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { erreurLecture, exigerActeur } from '#lib/server/formulaire-mur.ts';
import { gestes } from '#lib/server/gestes-mur.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const acteur = exigerActeur(locals);
	if (!/^\d+$/.test(params.id)) error(404, 'Cette publication n’existe plus');
	const id = Number(params.id);
	try {
		const maintenant = maintenantParis();
		const lu = await lirePublication(locals.base, acteur, id, maintenant);
		const p = lu.publication;
		if (p.cle !== params.mur) error(404, 'Cette publication n’existe plus');
		// Le suivi : pour l'auteur et les modérateurs, s'il y a une annonce à prendre en compte ou un événement.
		const suivi = p.droits.supprimer && (p.priseDeConnaissance || p.evenement) ? await suiviPublication(locals.base, acteur, id, maintenant.slice(0, 10)) : null;
		// Les équipes, pour nommer les convoqués.
		const equipes = Array.isArray(p.evenement?.convoques) ? await locals.base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).orderBy(asc(equipe.ordreRotation)) : [];
		return { ...lu, suivi, equipes };
	} catch (erreur) {
		erreurLecture(erreur);
	}
};

export const actions: Actions = gestes;

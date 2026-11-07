import { redirect } from '@sveltejs/kit';
import { DonneeInvalide, marquerLue } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { RequestHandler } from './$types';

// Une ligne de la cloche ouverte : marquée lue, puis sa page. Un simple lien, qui marche sans JavaScript.
// La page d'arrivée doit être dans l'appli : toute autre adresse ramène à la cloche.
export const GET: RequestHandler = async ({ locals, url }) => {
	const acteur = exigerActeur(locals);
	const id = url.searchParams.get('id') ?? '';
	if (/^[1-9]\d{0,14}$/.test(id)) {
		try {
			await marquerLue(locals.base, acteur, url.searchParams.get('genre') ?? '', Number(id), maintenantParis());
		} catch (erreur) {
			if (!(erreur instanceof DonneeInvalide)) throw erreur;
		}
	}
	redirect(303, interne(url.searchParams.get('vers') ?? '', url.origin));
};

// Le chemin est vérifié une fois relu : « /.//site » devient « //site », un autre site pour le navigateur.
function interne(vers: string, origine: string): string {
	const cible = new URL(vers, origine);
	const chemin = `${cible.pathname}${cible.search}${cible.hash}`;
	return vers.startsWith('/') && cible.origin === origine && !chemin.startsWith('//') ? chemin : '/notifications';
}

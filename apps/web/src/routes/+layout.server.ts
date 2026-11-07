import { aLeDroit, nonLusTotal, peutAttribuerQuelqueChose } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { lireEnTete } from '#lib/server/cloche.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	// « Réglages » : super administrateur, ou gestion des listes ou des comités du centre.
	const peutReglages = acteur === null ? false : acteur.type === 'super' || (await peutReglerLeCentre(base, acteur));
	// « Nominations » : dès qu'il y a au moins une responsabilité à attribuer.
	const peutNominations = acteur === null ? false : await peutAttribuerQuelqueChose(base, acteur, aujourdhuiParis());
	// La cloche et le visage de « Moi » ; la cloche est ensuite relue après chaque changement de page.
	const { cloche, visage } = acteur === null ? { cloche: 0, visage: null } : await lireEnTete(base, acteur);
	// La pastille d'Échanges : les messages non lus, ensuite suivis toutes les 30 s par la page.
	const nonLus = acteur?.type === 'personne' ? await compterNonLus(base, acteur) : 0;
	return {
		affichage: locals.affichage,
		connecte: acteur !== null,
		estPersonne: acteur?.type === 'personne',
		// Qui regarde, pour les fêtes déjà vues sur ce navigateur.
		qui: acteur === null ? '' : acteur.type === 'personne' ? `p${acteur.id}` : 'super',
		peutReglages,
		peutNominations,
		cloche,
		visage,
		nonLus
	};
};

async function peutReglerLeCentre(base: App.Locals['base'], acteur: NonNullable<App.Locals['acteur']>) {
	const aujourdhui = aujourdhuiParis();
	const centre = { type: 'centre' } as const;
	return (await aLeDroit(base, acteur, 'GERER_LISTES', centre, aujourdhui)) || (await aLeDroit(base, acteur, 'GERER_COMITES', centre, aujourdhui));
}

async function compterNonLus(base: App.Locals['base'], acteur: NonNullable<App.Locals['acteur']>) {
	try {
		return await nonLusTotal(base, acteur, aujourdhuiParis());
	} catch (erreur) {
		console.error('Pastille des messages illisible', erreur);
		return 0;
	}
}

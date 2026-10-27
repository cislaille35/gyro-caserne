import { aLeDroit, ceQueJePeuxAttribuer } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	// « Réglages » : super administrateur, ou gestion des listes ou des comités du centre.
	const peutReglages = acteur === null ? false : acteur.type === 'super' || (await peutReglerLeCentre(base, acteur));
	// « Nominations » : dès qu'il y a au moins une responsabilité à attribuer.
	const peutNominations = acteur === null ? false : (await ceQueJePeuxAttribuer(base, acteur, aujourdhuiParis())).length > 0;
	return {
		affichage: locals.affichage,
		connecte: acteur !== null,
		estPersonne: acteur?.type === 'personne',
		peutReglages,
		peutNominations
	};
};

async function peutReglerLeCentre(base: App.Locals['base'], acteur: NonNullable<App.Locals['acteur']>) {
	const aujourdhui = aujourdhuiParis();
	const centre = { type: 'centre' } as const;
	return (await aLeDroit(base, acteur, 'GERER_LISTES', centre, aujourdhui)) || (await aLeDroit(base, acteur, 'GERER_COMITES', centre, aujourdhui));
}

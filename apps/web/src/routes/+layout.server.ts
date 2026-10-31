import { aLeDroit, enTeteDe, nombreSignalements, nonLusTotal, peutAttribuerQuelqueChose } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	// « Réglages » : super administrateur, ou gestion des listes ou des comités du centre.
	const peutReglages = acteur === null ? false : acteur.type === 'super' || (await peutReglerLeCentre(base, acteur));
	// « Nominations » : dès qu'il y a au moins une responsabilité à attribuer.
	const peutNominations = acteur === null ? false : await peutAttribuerQuelqueChose(base, acteur, aujourdhuiParis());
	// La cloche : les notifications non lues, et les messages signalés pour qui modère (super administrateur compris) ; le visage de « Moi ».
	const { cloche, visage } = acteur === null ? { cloche: 0, visage: null } : await lireEnTete(base, acteur);
	// La pastille d'Échanges : les messages non lus, ensuite suivis toutes les 30 s par la page.
	const nonLus = acteur?.type === 'personne' ? await compterNonLus(base, acteur) : 0;
	return {
		affichage: locals.affichage,
		connecte: acteur !== null,
		estPersonne: acteur?.type === 'personne',
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

// Une panne passagère de la base ne doit pas faire tomber toutes les pages : la cloche reste muette.
async function lireEnTete(base: App.Locals['base'], acteur: NonNullable<App.Locals['acteur']>) {
	try {
		const [entete, signales] = await Promise.all([enTeteDe(base, acteur, aujourdhuiParis()), nombreSignalements(base, acteur, aujourdhuiParis())]);
		return { cloche: entete.nonLues + signales, visage: entete.visage };
	} catch (erreur) {
		console.error('Cloche illisible', erreur);
		return { cloche: 0, visage: null };
	}
}

async function compterNonLus(base: App.Locals['base'], acteur: NonNullable<App.Locals['acteur']>) {
	try {
		return await nonLusTotal(base, acteur, aujourdhuiParis());
	} catch (erreur) {
		console.error('Pastille des messages illisible', erreur);
		return 0;
	}
}

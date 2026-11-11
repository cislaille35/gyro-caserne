import { aLeDroit, enTeteDe, nombreAValider, nombreSignalements, nonLusTotal, peutAttribuerQuelqueChose } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	const { acteur, base } = locals;
	// Relue seule (sans recharger la page) après une page qui marque des notifications lues.
	depends('app:cloche');
	// « Réglages » : super administrateur, ou gestion des listes ou des comités du centre.
	const peutReglages = acteur === null ? false : acteur.type === 'super' || (await peutReglerLeCentre(base, acteur));
	// « Nominations » : dès qu'il y a au moins une responsabilité à attribuer.
	const peutNominations = acteur === null ? false : await peutAttribuerQuelqueChose(base, acteur, aujourdhuiParis());
	// La cloche : les notifications non lues, les messages signalés pour qui modère (super administrateur compris)
	// les demandes de réservation à trancher pour qui gère et les remplacements à valider pour les chefs ; le visage de « Moi » ;
	// la version de l'écusson du centre, lue dans le même envoi (null sans écusson : l'en-tête reste comme avant).
	const { cloche, visage, ecusson } = acteur === null ? { cloche: 0, visage: null, ecusson: null } : await lireEnTete(base, acteur);
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
		ecusson,
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
		const [entete, signales, aTrancher] = await Promise.all([enTeteDe(base, acteur, aujourdhuiParis(), maintenantParis()), nombreSignalements(base, acteur, aujourdhuiParis()), nombreAValider(base, acteur, aujourdhuiParis())]);
		return { cloche: entete.nonLues + entete.remplacementsAValider + signales + aTrancher, visage: entete.visage, ecusson: entete.ecusson };
	} catch (erreur) {
		console.error('Cloche illisible', erreur);
		return { cloche: 0, visage: null, ecusson: null };
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

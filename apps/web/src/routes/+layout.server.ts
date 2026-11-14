import { aLeDroit, enTeteDe, peutAttribuerQuelqueChose } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	const { acteur, base } = locals;
	// Relue seule (sans recharger la page) après une page qui marque des notifications lues.
	depends('app:cloche');
	const maintenant = maintenantParis();
	const aujourdhui = maintenant.slice(0, 10);
	// « Réglages » : super administrateur, ou gestion des listes ou des comités du centre.
	const peutReglages = acteur === null ? false : acteur.type === 'super' || (await peutReglerLeCentre(base, acteur, aujourdhui));
	// « Nominations » : dès qu'il y a au moins une responsabilité à attribuer.
	const peutNominations = acteur === null ? false : await peutAttribuerQuelqueChose(base, acteur, aujourdhui);
	// La cloche : les notifications non lues, les messages signalés pour qui modère (super administrateur compris)
	// les demandes de réservation à trancher pour qui gère et les remplacements à valider pour les chefs ; le visage de « Moi » ;
	// la version de l'écusson du centre (null sans écusson : l'en-tête reste comme avant) ; la pastille d'Échanges,
	// les messages non lus, ensuite suivis toutes les 30 s par la page. Une requête.
	const { cloche, visage, ecusson, nonLus } = acteur === null ? { cloche: 0, visage: null, ecusson: null, nonLus: 0 } : await lireEnTete(base, acteur, aujourdhui, maintenant);
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

async function peutReglerLeCentre(base: App.Locals['base'], acteur: NonNullable<App.Locals['acteur']>, aujourdhui: string) {
	const centre = { type: 'centre' } as const;
	return (await aLeDroit(base, acteur, 'GERER_LISTES', centre, aujourdhui)) || (await aLeDroit(base, acteur, 'GERER_COMITES', centre, aujourdhui));
}

// Une panne passagère de la base ne doit pas faire tomber toutes les pages : la cloche et la pastille restent muettes.
async function lireEnTete(base: App.Locals['base'], acteur: NonNullable<App.Locals['acteur']>, aujourdhui: string, maintenant: string) {
	try {
		const e = await enTeteDe(base, acteur, aujourdhui, maintenant);
		return { cloche: e.nonLues + e.remplacementsAValider + e.signalements + e.aTrancher, visage: e.visage, ecusson: e.ecusson, nonLus: e.nonLus };
	} catch (erreur) {
		console.error('Cloche illisible', erreur);
		return { cloche: 0, visage: null, ecusson: null, nonLus: 0 };
	}
}

import { error, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { demandeVue, DonneeInvalide, RefusDroit } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerConnecte, gestesRemplacement, RESULTATS } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

// Une demande (`?envoyee` : juste après l'envoi) : pour qui y a part (demandeur, destinataire, remplaçant, chef qui valide).
// Un collègue qui l'avait reçue, une fois tranchée sans lui, n'en voit que l'issue (`reduite`).
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const acteur = exigerConnecte(locals);
	const id = /^\d{1,9}$/.test(params.id) ? Number(params.id) : 0;
	try {
		const lue = await demandeVue(locals.base, acteur, id, maintenantParis(), centre.astreinte);
		if ('reduite' in lue) return { reduite: lue.reduite, demande: null, disponibles: [], recue: null, valideurs: [], envoyee: false };
		return { reduite: null, ...lue, envoyee: url.searchParams.has('envoyee') };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Demande introuvable');
		if (erreur instanceof RefusDroit) error(403, erreur.message);
		throw erreur;
	}
};

type Evenement = { locals: App.Locals; request: Request; params: { id: string } };

// Après ce geste, la demande peut ne plus regarder l'agent (il l'a refusée, par exemple) : sa page répondrait « refusé ».
// On le ramène alors à la liste, où le résultat est dit.
function puisListeSiPlusConcerne(nom: keyof typeof RESULTATS) {
	return async (evenement: Evenement) => {
		const resultat = await gestesRemplacement[nom](evenement);
		if ('succes' in resultat) {
			const id = /^\d{1,9}$/.test(evenement.params.id) ? Number(evenement.params.id) : 0;
			try {
				const lue = await demandeVue(evenement.locals.base, exigerConnecte(evenement.locals), id, maintenantParis(), centre.astreinte);
				if ('reduite' in lue) redirect(303, `/remplacements?fait=${nom}`);
			} catch (erreur) {
				if (erreur instanceof RefusDroit) redirect(303, `/remplacements?fait=${nom}`);
				throw erreur;
			}
		}
		return resultat;
	};
}

export const actions: Actions = {
	...gestesRemplacement,
	refuser: puisListeSiPlusConcerne('refuser'),
	desister: puisListeSiPlusConcerne('desister'),
	refuserValidation: puisListeSiPlusConcerne('refuserValidation')
};

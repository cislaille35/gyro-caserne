import { error, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { demandeVue, DonneeInvalide, RefusDroit } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { exigerConnecte, gestesRemplacement, RESULTATS } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

// Une demande (`?envoyee` : juste après l'envoi) : pour qui y a part (demandeur, destinataire, remplaçant, chef qui valide).
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const acteur = exigerConnecte(locals);
	const id = /^\d{1,9}$/.test(params.id) ? Number(params.id) : 0;
	try {
		return { ...(await demandeVue(locals.base, acteur, id, maintenantParis(), centre.astreinte)), envoyee: url.searchParams.has('envoyee') };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Demande introuvable');
		if (erreur instanceof RefusDroit) error(403, 'Cette demande ne vous concerne pas, ou elle a déjà été prise par un collègue.');
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
				await demandeVue(evenement.locals.base, exigerConnecte(evenement.locals), id, maintenantParis(), centre.astreinte);
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

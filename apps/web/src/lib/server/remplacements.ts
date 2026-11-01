import { fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { accepterDemande, annulerDemande, desister, DonneeInvalide, ouvrirATous, RefusDroit, refuserDemande, refuserValidation, valider, type Acteur } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';

export function exigerConnecte(locals: App.Locals): Acteur {
	if (!locals.acteur) redirect(303, '/connexion');
	return locals.acteur;
}

const idDe = (brut: FormDataEntryValue | null) => (typeof brut === 'string' && /^\d{1,9}$/.test(brut) ? Number(brut) : 0);
const phrase = (texte: string) => (texte.endsWith('.') ? texte : `${texte}.`);

// Les refus du socle, dits sur la page ; le reste remonte.
export function refus(erreur: unknown) {
	if (erreur instanceof RefusDroit || erreur instanceof DonneeInvalide) return fail(erreur instanceof RefusDroit ? 403 : 400, { message: phrase(erreur.message) });
	throw erreur;
}

type Geste = (base: App.Locals['base'], acteur: Acteur, id: number, formulaire: FormData) => Promise<unknown>;

async function geste(locals: App.Locals, request: Request, faire: Geste, succes: string) {
	const acteur = exigerConnecte(locals);
	const formulaire = await request.formData();
	try {
		await faire(locals.base, acteur, idDe(formulaire.get('id')), formulaire);
	} catch (erreur) {
		return refus(erreur);
	}
	return { succes };
}

const m = () => maintenantParis();
const r = centre.astreinte;

// Les gestes d'une demande, communs à la liste et au détail.
export const gestesRemplacement = {
	accepter: async ({ locals, request }: { locals: App.Locals; request: Request }) => {
		const acteur = exigerConnecte(locals);
		const formulaire = await request.formData();
		let etat: string;
		try {
			etat = await accepterDemande(locals.base, acteur, idDe(formulaire.get('id')), m(), r);
		} catch (erreur) {
			return refus(erreur);
		}
		return { succes: etat === 'a_valider' ? 'Accepté : le chef de garde doit maintenant valider. Vous serez prévenu.' : 'Accepté : c’est conclu. Pensez à mettre à jour votre disponibilité dans l’appli du SDIS.' };
	},
	refuser: ({ locals, request }: { locals: App.Locals; request: Request }) => geste(locals, request, (b, a, id) => refuserDemande(b, a, id, m(), r), 'Demande refusée.'),
	ouvrir: ({ locals, request }: { locals: App.Locals; request: Request }) => geste(locals, request, (b, a, id) => ouvrirATous(b, a, id, m(), r), 'Demande ouverte à tous les disponibles.'),
	annuler: ({ locals, request }: { locals: App.Locals; request: Request }) => geste(locals, request, (b, a, id) => annulerDemande(b, a, id, m(), r), 'Demande annulée.'),
	desister: ({ locals, request }: { locals: App.Locals; request: Request }) => geste(locals, request, (b, a, id) => desister(b, a, id, m(), r), 'Vous ne remplacez plus : le titulaire est prévenu.'),
	valider: ({ locals, request }: { locals: App.Locals; request: Request }) => geste(locals, request, (b, a, id) => valider(b, a, id, m(), r), 'Remplacement validé : les deux agents sont prévenus.'),
	refuserValidation: ({ locals, request }: { locals: App.Locals; request: Request }) =>
		geste(locals, request, (b, a, id, f) => refuserValidation(b, a, id, typeof f.get('motif') === 'string' ? (f.get('motif') as string) : null, m(), r), 'Remplacement refusé : la demande repart, les deux agents sont prévenus.')
};

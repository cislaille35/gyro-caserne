import { fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, RefusDroit, type Acteur } from '@gyro-caserne/socle';

export function exigerConnecte(locals: App.Locals): Acteur {
	if (!locals.acteur) redirect(303, '/connexion');
	return locals.acteur;
}

// Un identifiant de route ou de formulaire ; 0 s'il est mal écrit (le socle le refuse).
export const idDe = (brut: unknown) => (typeof brut === 'string' && /^\d{1,9}$/.test(brut) ? Number(brut) : 0);

export const champ = (formulaire: FormData, nom: string) => {
	const v = formulaire.get(nom);
	return typeof v === 'string' ? v : '';
};

const phrase = (texte: string) => (texte.endsWith('.') ? texte : `${texte}.`);

// Les refus du socle, dits sur la page ; le reste remonte.
export function refus(erreur: unknown, valeurs: Record<string, string> = {}) {
	if (erreur instanceof RefusDroit) return fail(403, { message: phrase(erreur.message), valeurs });
	if (erreur instanceof DonneeInvalide) return fail(400, { message: phrase(erreur.message), valeurs });
	throw erreur;
}

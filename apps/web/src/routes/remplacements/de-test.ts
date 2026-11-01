import { publierAnnee, reglerRoulement } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { preparer as preparerPlanning } from '../planning/de-test.ts';

// Le jeu du planning (chef, Alice équipe 1, Bruno équipe 2), l'année suivante publiée aussi : il y a toujours des semaines à venir.
export async function preparer() {
	const jeu = await preparerPlanning();
	await reglerRoulement(jeu.base, jeu.chef, jeu.annee + 1, jeu.ids, maintenantParis());
	await publierAnnee(jeu.base, jeu.chef, jeu.annee + 1, maintenantParis());
	return jeu;
}

export const locaux = (base: { photos: unknown }, acteur: unknown) => ({ base, basePhotos: base.photos, acteur });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const charger = (load: unknown, locals: unknown, chemin = '/remplacements', params: Record<string, string> = {}) => (load as any)({ locals, params, url: new URL(`http://x${chemin}`) });

export function envoyer(actions: Record<string, unknown>, nom: string, locals: unknown, corps: [string, string][], params: Record<string, string> = {}) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (actions[nom] as any)({ locals, params, url: new URL('http://x/remplacements'), request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });
}

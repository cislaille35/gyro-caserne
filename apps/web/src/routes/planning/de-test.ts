import centre from '$centre';
import { equipe, publierAnnee, reglerRoulement } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { preparer as preparerEchanges } from '../echanges/de-test.ts';

// Chef de centre (sans équipe), Alice (équipe 1), Bruno (équipe 2) ; l'année en cours, roulement 1-2-3-4.
export async function preparer({ publiee = true } = {}) {
	const jeu = await preparerEchanges();
	const ids = (await jeu.base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const annee = Number(aujourdhuiParis().slice(0, 4));
	await reglerRoulement(jeu.base, jeu.chef, annee, ids, maintenantParis());
	if (publiee) await publierAnnee(jeu.base, jeu.chef, annee, maintenantParis());
	return { ...jeu, ids, annee, reglage: centre.astreinte };
}

export const locaux = (base: { photos: unknown }, acteur: unknown) => ({ base, basePhotos: base.photos, acteur });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const charger = (load: unknown, locals: unknown, recherche = '') => (load as any)({ locals, url: new URL(`http://x/planning${recherche}`) });

// Une action comme SvelteKit l'appelle.
export function envoyer(actions: Record<string, unknown>, nom: string, locals: unknown, corps: [string, string][], recherche = '') {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (actions[nom] as any)({ locals, url: new URL(`http://x/planning/preparer${recherche}`), request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });
}

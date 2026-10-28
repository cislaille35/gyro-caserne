import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { epingler, equipe, lireMur, modifierPublication, publication, publier, supprimerPublication, type Acteur } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { echecMur, envoiTropLourd, erreurLecture, exigerActeur, lirePublication, type Reponse } from '#lib/server/formulaire-mur.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const acteur = exigerActeur(locals);
	const avant = url.searchParams.get('avant');
	try {
		const mur = await lireMur(locals.base, acteur, params.mur, { avant: avant === null ? undefined : /^\d+$/.test(avant) ? Number(avant) : NaN, nombre: 20 }, maintenantParis());
		// Les équipes, pour nommer les convoqués et convoquer (les actives) ; sur un mur d'équipe, c'est l'équipe du mur.
		const equipes = mur.mur.type === 'equipe' ? [] : await locals.base.select({ id: equipe.id, nom: equipe.nom, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation));
		return { ...mur, equipes, plusAnciennes: avant !== null };
	} catch (erreur) {
		erreurLecture(erreur);
	}
};

// L'identifiant d'une publication visée par un bouton.
const idDe = (f: FormData) => {
	const brut = f.get('id');
	return typeof brut === 'string' && /^\d+$/.test(brut) ? Number(brut) : null;
};

// Une publication visée depuis la page d'un mur doit être de ce mur ; sinon, elle n'existe pas ici.
async function surPublication(locals: App.Locals, params: { mur: string }, request: Request, faire: (acteur: Acteur, id: number, f: FormData) => Promise<string>) {
	const acteur = exigerActeur(locals);
	const f = await request.formData();
	const id = idDe(f);
	if (id === null) return fail<Reponse>(400, { cible: 'publication', message: 'Cette publication n’existe plus.' });
	const cible = `publication:${id}`;
	const [ligne] = await locals.base.select({ mur: publication.mur }).from(publication).where(eq(publication.id, id));
	if (ligne?.mur !== params.mur) return fail<Reponse>(404, { cible, message: 'Cette publication n’existe plus.' });
	try {
		return { cible, succes: await faire(acteur, id, f) } satisfies Reponse;
	} catch (erreur) {
		return echecMur(erreur, cible);
	}
}

export const actions: Actions = {
	publier: async ({ locals, params, request }) => {
		const acteur = exigerActeur(locals);
		if (envoiTropLourd(request)) return fail<Reponse>(413, { cible: 'publier', message: 'Envoi trop lourd : 4 photos de 400 Ko au plus. Sans JavaScript, réduisez vos photos avant de les envoyer.' });
		const { donnees, valeurs, erreurs } = await lirePublication(await request.formData());
		if (!donnees) return fail<Reponse>(400, { cible: 'publier', erreurs, valeurs });
		try {
			await publier(locals.base, acteur, params.mur, donnees, maintenantParis());
		} catch (erreur) {
			return echecMur(erreur, 'publier', valeurs);
		}
		return { cible: 'publier', succes: 'Publication envoyée.' } satisfies Reponse;
	},
	modifier: ({ locals, params, request }) =>
		surPublication(locals, params, request, async (acteur, id, f) => {
			const texte = f.get('texte');
			await modifierPublication(locals.base, acteur, id, { texte: typeof texte === 'string' ? texte : '' }, maintenantParis());
			return 'Publication modifiée.';
		}),
	supprimer: ({ locals, params, request }) =>
		surPublication(locals, params, request, async (acteur, id) => {
			await supprimerPublication(locals.base, acteur, id, maintenantParis());
			return 'Publication supprimée.';
		}),
	epingler: ({ locals, params, request }) =>
		surPublication(locals, params, request, async (acteur, id, f) => {
			const oui = f.get('oui') === '1';
			await epingler(locals.base, acteur, id, oui, maintenantParis());
			return oui ? 'Publication épinglée.' : 'Épingle retirée.';
		})
};

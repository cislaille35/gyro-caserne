import { fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { apercusDesMurs, audiences, equipe, mursDe, publier } from '@gyro-caserne/socle';
import { aujourdhuiParis, clotureParDefaut, maintenantParis } from '#lib/aujourdhui.ts';
import { echecMur, envoiTropLourd, exigerActeur, lirePublication, type Reponse } from '#lib/server/formulaire-mur.ts';
import type { Actions, PageServerLoad } from './$types';

// Les murs où l'on peut publier, avec qui les voit et leur identité (pastille, couleur).
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerActeur(locals);
	const aujourdhui = aujourdhuiParis();
	const [murs, apercus, equipes] = await Promise.all([
		mursDe(locals.base, acteur, aujourdhui),
		apercusDesMurs(locals.base, acteur, aujourdhui),
		locals.base.select({ id: equipe.id, nom: equipe.nom, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation))
	]);
	const ouverts = murs.filter((m) => m.peutPublier);
	const nombres = await audiences(locals.base, ouverts.map((m) => m.cle), aujourdhui);
	const proposes = ouverts.map((m) => {
		const a = apercus.find((x) => x.cle === m.cle);
		return { cle: m.cle, nom: m.nom, type: m.type, peutModerer: m.peutModerer, audience: nombres.get(m.cle) ?? 0, icone: a?.icone ?? null, couleur: a?.couleur ?? null, numero: a?.numero ?? null };
	});
	const demande = url.searchParams.get('mur');
	const ouverture = maintenantParis().slice(0, 16);
	const choisi = proposes.find((m) => m.cle === demande)?.cle ?? null;
	return {
		murs: proposes,
		choisi,
		// Texte prérempli : seulement pour le lien « Souhaiter », vers Vie du centre.
		texte: choisi === 'vie' ? (url.searchParams.get('texte') ?? '').slice(0, 4000) : '',
		ouverture,
		cloture: clotureParDefaut(ouverture),
		equipes
	};
};

export const actions: Actions = {
	publier: async ({ locals, request }) => {
		const acteur = exigerActeur(locals);
		if (envoiTropLourd(request)) return fail<Reponse>(413, { cible: 'publier', message: 'Envoi trop lourd : 4 photos de 400 Ko au plus. Sans JavaScript, réduisez vos photos avant de les envoyer.' });
		const { donnees, valeurs, erreurs } = await lirePublication(await request.formData());
		if (!donnees) return fail<Reponse>(400, { cible: 'publier', erreurs, valeurs });
		let id: number;
		try {
			id = await publier(locals.base, acteur, valeurs.mur!, donnees, maintenantParis());
		} catch (erreur) {
			return echecMur(erreur, 'publier', valeurs);
		}
		redirect(303, `/echanges/${valeurs.mur}#publication-${id}`);
	}
};

import { ajouterRessource, modifierRessource, ressourcesAGerer, retirerRessource } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { champ, exigerConnecte, idDe, refus } from '#lib/server/reservations.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const gestion = await ressourcesAGerer(locals.base, exigerConnecte(locals), aujourdhuiParis());
	return { ...gestion, confirmer: idDe(url.searchParams.get('retirer')) || null };
};

// Un stock mal écrit devient NaN : le socle le refuse (« Stock invalide »).
const stockDe = (brut: string) => (/^\d+$/.test(brut.trim()) ? Number(brut) : Number.NaN);

export const actions: Actions = {
	ajouter: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const f = await request.formData();
		const valeurs = { nom: champ(f, 'nom'), stock: champ(f, 'stock'), icone: champ(f, 'icone'), comite: champ(f, 'comite') };
		try {
			// Sans comité choisi (un seul possible), le premier de l'acteur.
			const comiteId = idDe(valeurs.comite) || (await ressourcesAGerer(locals.base, acteur, aujourdhuiParis())).comites[0]?.id || 0;
			await ajouterRessource(locals.base, acteur, { nom: valeurs.nom, stock: stockDe(valeurs.stock), icone: valeurs.icone, comiteId }, maintenantParis());
		} catch (erreur) {
			return refus(erreur, valeurs);
		}
		return { succes: `${valeurs.nom.trim()} ajouté.` };
	},
	modifier: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const f = await request.formData();
		const nom = champ(f, 'nom');
		try {
			await modifierRessource(locals.base, acteur, idDe(champ(f, 'id')), { nom, stock: stockDe(champ(f, 'stock')), icone: champ(f, 'icone') }, maintenantParis());
		} catch (erreur) {
			return refus(erreur);
		}
		return { succes: `${nom.trim()} enregistré.` };
	},
	retirer: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const id = idDe(champ(await request.formData(), 'id'));
		const nom = (await ressourcesAGerer(locals.base, acteur, aujourdhuiParis())).ressources.find((r) => r.id === id)?.nom ?? 'Le matériel';
		try {
			await retirerRessource(locals.base, acteur, id, maintenantParis());
		} catch (erreur) {
			return refus(erreur);
		}
		return { succes: `${nom} retiré : ses réservations à venir sont annulées.` };
	}
};

import { error, redirect } from '@sveltejs/kit';
import { creerResponsabilite, DonneeInvalide, estDroitPouvoir, MODELES } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { accesReglages, attributeurDe, comitesChoix, echec, texte, type Valeurs } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

async function acces(locals: App.Locals) {
	const aujourdhui = aujourdhuiParis();
	const a = await accesReglages(locals, aujourdhui);
	if (!a.listes) error(403, 'Accès réservé à qui gère les responsabilités du centre');
	return { ...a, aujourdhui };
}

// D'abord le modèle (cartes), puis le nom, la portée, qui attribue et l'icône.
export const load: PageServerLoad = async ({ locals, url }) => {
	const { base, pouvoir } = await acces(locals);
	const modeles = MODELES.map((m) => ({ ...m, reserve: !pouvoir && m.droits.some(estDroitPouvoir) }));
	return {
		modeles,
		choisi: modeles.find((m) => m.id === url.searchParams.get('modele')) ?? null,
		comitesChoix: await comitesChoix(base)
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const { acteur, base, aujourdhui } = await acces(locals);
		const formulaire = await request.formData();
		const valeurs: Valeurs & { modele?: string } = {
			modele: texte(formulaire, 'modele'),
			nom: texte(formulaire, 'nom') ?? '',
			nature: texte(formulaire, 'nature'),
			portee: texte(formulaire, 'portee'),
			attributeur: texte(formulaire, 'attributeur'),
			icone: texte(formulaire, 'icone') || undefined
		};
		const cible = 'role-nouveau';
		const modele = MODELES.find((m) => m.id === valeurs.modele);
		if (!modele) return echec(new DonneeInvalide('Modèle inconnu'), cible, valeurs);
		const qui = attributeurDe(valeurs.attributeur);
		if (!qui) return echec(new DonneeInvalide('Attributeur inconnu'), cible, valeurs);
		let id: number;
		try {
			// Les droits sont ceux du modèle, jamais ceux du formulaire.
			id = await creerResponsabilite(
				base,
				acteur,
				{ nom: valeurs.nom ?? '', nature: valeurs.nature as 'fonction' | 'mission', portee: valeurs.portee as 'centre' | 'equipe' | 'comite', attributeur: qui, droits: modele.droits, modele: modele.id, icone: valeurs.icone },
				aujourdhui
			);
		} catch (erreur) {
			return echec(erreur, cible, valeurs);
		}
		redirect(303, `/reglages/roles/${id}`);
	}
};

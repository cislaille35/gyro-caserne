import { error } from '@sveltejs/kit';
import { DonneeInvalide, lireFiche, modifierFicheEngin, type Geste } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { champ, exigerGestionEngins, idDe, quantiteDe, refus } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

// L'éditeur de la fiche d'un type d'engin. ?retirer-zone=<ref> : la confirmation avant de retirer une zone et ses éléments.
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { base } = await exigerGestionEngins(locals);
	try {
		return { fiche: await lireFiche(base, idDe(params.id)), retirerZone: idDe(url.searchParams.get('retirer-zone')) || null, nouveau: url.searchParams.has('nouveau') };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cette fiche n’existe pas.');
		throw erreur;
	}
};

// Le geste demandé par le formulaire ; null s'il est inconnu.
function gesteDe(f: FormData): Geste | null {
	const zone = idDe(champ(f, 'zone'));
	const element = idDe(champ(f, 'element'));
	const nom = champ(f, 'nom');
	const libelle = champ(f, 'libelle');
	const quantite = quantiteDe(champ(f, 'quantite'));
	switch (champ(f, 'quoi')) {
		case 'ajouter_zone':
			return { quoi: 'ajouter_zone', nom };
		case 'renommer_zone':
			return { quoi: 'renommer_zone', zone, nom };
		case 'monter_zone':
			return { quoi: 'deplacer_zone', zone, sens: -1 };
		case 'descendre_zone':
			return { quoi: 'deplacer_zone', zone, sens: 1 };
		case 'retirer_zone':
			return { quoi: 'retirer_zone', zone };
		case 'ajouter_element':
			return { quoi: 'ajouter_element', zone, libelle, quantite };
		case 'modifier_element':
			return { quoi: 'modifier_element', element, zone, libelle, quantite };
		case 'monter_element':
			return { quoi: 'deplacer_element', element, sens: -1 };
		case 'descendre_element':
			return { quoi: 'deplacer_element', element, sens: 1 };
		case 'retirer_element':
			return { quoi: 'retirer_element', element };
		default:
			return null;
	}
}

const SUCCES: Record<Geste['quoi'], string> = {
	ajouter_zone: 'Zone ajoutée.',
	renommer_zone: 'Zone renommée.',
	deplacer_zone: 'Zone déplacée.',
	retirer_zone: 'Zone retirée.',
	ajouter_element: 'Élément ajouté.',
	modifier_element: 'Élément enregistré.',
	deplacer_element: 'Élément déplacé.',
	retirer_element: 'Élément retiré.'
};

export const actions: Actions = {
	// `cible` : le formulaire concerné, pour dire le message à côté ; `zone` : la zone à garder ouverte.
	geste: async ({ locals, params, request }) => {
		const { acteur, base } = await exigerGestionEngins(locals);
		const f = await request.formData();
		const geste = gesteDe(f);
		const cible = champ(f, 'cible');
		const zone = idDe(champ(f, 'zone')) || null;
		if (!geste) return refus(new DonneeInvalide('Geste inconnu'), { cible, zone });
		try {
			await modifierFicheEngin(base, acteur, idDe(params.id), geste, maintenantParis());
		} catch (erreur) {
			return refus(erreur, { cible, zone, valeurs: { nom: champ(f, 'nom'), libelle: champ(f, 'libelle'), quantite: champ(f, 'quantite') } });
		}
		return { cible, zone: geste.quoi === 'ajouter_zone' ? 'derniere' : geste.quoi === 'retirer_zone' ? null : zone, succes: SUCCES[geste.quoi] };
	}
};

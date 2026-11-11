import { MODELES } from './modeles.ts';

// Icônes des rôles : les tracés sont dans l'appli (icones-roles.ts), mêmes noms.
export const NOMS_ICONES = ['etoile', 'casque', 'camion', 'croix', 'cle', 'ballon', 'livre', 'groupe', 'coeur', 'outil', 'veste', 'banc', 'table', 'tente'] as const;
export type NomIcone = (typeof NOMS_ICONES)[number];

// Une seule règle partout : l'icône choisie, sinon celle du modèle, sinon d'après le nom, sinon celle du thème (la portée).
export function iconeDuRole(r: { nom: string; icone: string | null; modele: string | null; systeme: string | null; portee: string }): NomIcone {
	if (r.icone && (NOMS_ICONES as readonly string[]).includes(r.icone)) return r.icone as NomIcone;
	const deModele = MODELES.find((m) => m.id === r.modele)?.icone;
	if (deModele) return deModele;
	const n = r.nom.toLowerCase();
	if (n.includes('engin')) return 'camion';
	if (n.includes('pharmacie')) return 'croix';
	if (n.includes('technique')) return 'cle';
	if (n.includes('habillement')) return 'veste';
	if (r.systeme === 'chef_centre' || r.systeme === 'chef_centre_adjoint') return 'etoile';
	return r.portee === 'equipe' ? 'casque' : r.portee === 'comite' ? 'groupe' : 'outil';
}

// L'icône choisie, sinon celle du thème : cœur pour l'amicale, étoile pour le centre, groupe pour les autres.
export function iconeDuComite(c: { icone: string | null; theme: string }): NomIcone {
	if (c.icone && (NOMS_ICONES as readonly string[]).includes(c.icone)) return c.icone as NomIcone;
	return c.theme === 'amicale' ? 'coeur' : c.theme === 'centre' ? 'etoile' : 'groupe';
}

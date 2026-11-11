import type { Attributeur } from '@gyro-caserne/socle';
import type { IconeRole } from '#lib/ui/icones-roles.ts';

// Les icônes proposées, avec leur nom lu par les lecteurs d'écran.
export const NOMS_ICONES: Record<IconeRole, string> = {
	etoile: 'Étoile',
	casque: 'Casque',
	camion: 'Camion',
	croix: 'Croix',
	cle: 'Clé',
	ballon: 'Ballon',
	livre: 'Livre',
	groupe: 'Groupe',
	coeur: 'Cœur',
	outil: 'Outil',
	veste: 'Veste',
	banc: 'Banc',
	table: 'Table',
	tente: 'Tente'
};

export const PORTEES = [
	{ valeur: 'centre', libelle: 'Tout le centre' },
	{ valeur: 'equipe', libelle: 'Une équipe' },
	{ valeur: 'comite', libelle: 'Un comité' }
];

export const NATURES = [
	{ valeur: 'fonction', libelle: 'Fonction' },
	{ valeur: 'mission', libelle: 'Mission' }
];

export function valeurAttributeur(a: Attributeur): string {
	return a.type === 'comite' ? `comite:${a.id}` : a.type;
}

export function quiAttribue(a: Attributeur, comites: { id: number; nom: string }[]): string {
	if (a.type === 'comite') return `nommé par le comité « ${comites.find((c) => c.id === a.id)?.nom ?? 'dissous'} »`;
	return a.type === 'comite_vise' ? 'nommé par son comité' : 'nommé par le chef de centre';
}

export function optionsAttributeur(comites: { id: number; nom: string }[]) {
	return [
		{ valeur: 'chef_centre', libelle: 'Le chef de centre' },
		{ valeur: 'comite_vise', libelle: 'Le comité visé (portée « comité » seulement)' },
		...comites.map((c) => ({ valeur: `comite:${c.id}`, libelle: `Le comité « ${c.nom} »` }))
	];
}

export const titulaires = (n: number) => (n === 0 ? 'Aucun titulaire' : n === 1 ? '1 titulaire' : `${n} titulaires`);

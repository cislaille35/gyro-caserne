import { error, fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, gereLesEngins, RefusDroit, voitLesEngins, type Acteur, type FichierFichesLu, type SituationEngin } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';

export const REFUS_GESTION = 'Les engins et leurs fiches sont gérés par le chef de centre, son adjoint, les chefs de garde et le référent engins.';

// Connecté et autorisé à voir les engins ; sinon 403 net.
export async function accesEngins(locals: App.Locals) {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	if (!(await voitLesEngins(base, acteur, aujourdhui))) error(403, 'Accès réservé aux agents du centre.');
	return { acteur: acteur as Acteur, base, aujourdhui };
}

export async function exigerGestionEngins(locals: App.Locals) {
	const acces = await accesEngins(locals);
	if (!(await gereLesEngins(acces.base, acces.acteur, acces.aujourdhui))) error(403, REFUS_GESTION);
	return acces;
}

// Un identifiant de route ou de formulaire ; 0 s'il est mal écrit (le socle le refuse).
export const idDe = (brut: unknown) => (typeof brut === 'string' && /^\d{1,9}$/.test(brut) ? Number(brut) : 0);

export const champ = (formulaire: FormData, nom: string) => {
	const v = formulaire.get(nom);
	return typeof v === 'string' ? v : '';
};

// Une quantité tapée : vide → aucune ; sinon un nombre (le socle refuse ce qui n'est pas un entier de 1 à 999).
export const quantiteDe = (brut: string) => (brut.trim() === '' ? null : /^\d+$/.test(brut.trim()) ? Number(brut) : Number.NaN);

const PHRASES: Record<string, string> = {
	'Nom vide': 'Indiquez le nom.',
	'Nom trop long': 'Le nom est trop long.',
	'Nom déjà utilisé': 'Ce nom est déjà pris par un engin du centre.',
	'Type déjà présent': 'Ce type d’engin existe déjà.',
	'Caractère interdit dans le type': 'Le type ne peut contenir aucun de ces signes, refusés par Excel : deux-points, \\ / ? * [ ].',
	'Fiche changée entre-temps': 'La fiche vient d’être modifiée par quelqu’un d’autre : elle est rechargée, refaites votre geste.',
	'Provenance vide': 'Indiquez le centre qui prête l’engin.',
	'Provenance trop longue': 'Le nom du centre qui prête est trop long (60 caractères au plus).',
	'Immatriculation trop longue': 'L’immatriculation est trop longue (12 caractères au plus).',
	'Nom de zone vide': 'Indiquez le nom de la zone.',
	'Nom de zone trop long': 'Le nom de la zone est trop long (40 caractères au plus).',
	'Zone déjà présente': 'Cette fiche a déjà une zone de ce nom.',
	'Élément vide': 'Indiquez l’élément à vérifier.',
	'Élément trop long': 'L’élément est trop long (120 caractères au plus).',
	'Quantité invalide': 'La quantité est un nombre entier de 1 à 999, ou rien si l’élément est seulement présent ou manquant.',
	'Trop de zones': 'Une fiche a 30 zones au plus.',
	'Trop d’éléments': 'Une fiche a 300 éléments au plus.',
	'Zone inconnue': 'Cette zone n’existe plus : la page a été rechargée.',
	'Élément inconnu': 'Cet élément n’existe plus : la page a été rechargée.',
	'Zones à voir': 'Il reste des zones à voir : marquez chacune « Tout est complet » avant de valider.',
	'Relève passée': 'Cette prise appartient à une relève passée : rechargez la page pour celle en cours.',
	'Prise déjà validée': 'Cette prise est déjà validée.',
	'Prise changée entre-temps': 'Un collègue vient de modifier la prise : elle est rechargée, refaites votre geste.',
	'Prise inconnue': 'Cette prise n’existe plus : un collègue l’a peut-être abandonnée.',
	'Élément déjà signalé': 'Cet élément est déjà signalé : dites plutôt s’il est retrouvé.',
	'Nombre manquant invalide': 'Le nombre manquant va de 1 à la quantité attendue.',
	'Note trop longue': 'La note est trop longue (300 caractères au plus).',
	'Participant inconnu': 'Un des participants n’est plus agent du centre : la page a été rechargée.',
	'Anomalie inconnue': 'Ce signalement est déjà clos : la page a été rechargée.',
	'Engin parti': 'Cet engin a quitté le centre : pas de prise de garde.',
	'Réservé aux agents': 'La prise de garde est faite par les agents du centre.',
	'Photo JPEG ou WebP seulement': 'La photo doit être en JPEG ou WebP.',
	'Photo trop lourde (200 Ko au plus)': 'Photo trop lourde : 200 Ko au plus.'
};

export const phraseDe = (message: string) => PHRASES[message] ?? (message.endsWith('.') ? message : `${message}.`);

// Les refus du socle, dits sur la page ; le reste remonte.
export function refus<T extends Record<string, unknown>>(erreur: unknown, plus: T = {} as T) {
	if (erreur instanceof RefusDroit) return fail(403, { ...plus, message: REFUS_GESTION });
	if (erreur instanceof DonneeInvalide) return fail(400, { ...plus, message: phraseDe(erreur.message) });
	throw erreur;
}

const LIGNES_MAX = 400;
const textes = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 20 && v.every((t) => typeof t === 'string' && t.length <= 500);

// Le fichier lu vient du navigateur : sa forme est vérifiée avant le calcul.
export function estFichierFichesLu(v: unknown): v is FichierFichesLu {
	if (typeof v !== 'object' || v === null) return false;
	const { feuilles, entetes } = v as Record<string, unknown>;
	if (typeof feuilles !== 'object' || feuilles === null || Object.keys(feuilles).length > 50) return false;
	if (entetes !== undefined && (typeof entetes !== 'object' || entetes === null || !Object.values(entetes).every(textes))) return false;
	return Object.values(feuilles).every((lignes) => Array.isArray(lignes) && lignes.length <= LIGNES_MAX && lignes.every((l) => typeof l === 'object' && l !== null && Number.isSafeInteger(l.numero) && textes(l.cellules)));
}

// Le formulaire d'un engin, tel que tapé (renvoyé sur la page s'il est refusé).
export function saisieEngin(f: FormData) {
	const situation = champ(f, 'situation');
	const valeurs = {
		nom: champ(f, 'nom'),
		typeId: champ(f, 'type'),
		immatriculation: champ(f, 'immatriculation'),
		situation: (['centre', 'prete', 'parti'].includes(situation) ? situation : 'centre') as SituationEngin,
		provenance: champ(f, 'provenance')
	};
	return { valeurs, saisie: { ...valeurs, typeId: idDe(valeurs.typeId) } };
}

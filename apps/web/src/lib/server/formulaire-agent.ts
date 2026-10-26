import { error, fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, estGestionnaire, normaliserAdresse, RefusDroit, type Acteur } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';

// Écrans de gestion : réservés au chef de centre, à l'adjoint et au super administrateur.
export async function exigerGestion(locals: App.Locals): Promise<{ acteur: Acteur; aujourdhui: string }> {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	if (!(await estGestionnaire(base, acteur, aujourdhui))) error(403, 'Accès réservé au chef de centre et à son adjoint');
	return { acteur, aujourdhui };
}

const OBLIGATOIRES = { email: 'Indiquez l’adresse e-mail.', prenom: 'Indiquez le prénom.', nom: 'Indiquez le nom.' } as const;
const DATES = ['dateGrade', 'naissance', 'entreeCentre', 'engagementSpv'] as const;
const IDENTIFIANTS = ['gradeId', 'profilId', 'equipeId'] as const;

function dateValide(date: string): boolean {
	const jour = new Date(`${date}T00:00:00Z`);
	return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(jour.getTime()) && jour.toISOString().slice(0, 10) === date;
}

export type ChampsLus = {
	email?: string;
	prenom?: string;
	nom?: string;
	telephone?: string | null;
	gradeId?: number | null;
	profilId?: number | null;
	equipeId?: number | null;
} & Partial<Record<(typeof DATES)[number], string | null>>;

// Lit les seuls champs envoyés (à l'ajout, les obligatoires comptent même absents). Un champ facultatif vide devient null.
export function lireFormulaire(formulaire: FormData, superAdmins: string[], ajout = false) {
	const valeurs: Record<string, string> = {};
	for (const [cle, brut] of formulaire) if (typeof brut === 'string') valeurs[cle] = brut;
	if (ajout) for (const cle of ['email', 'prenom', 'nom', 'profilId']) valeurs[cle] ??= '';
	const champs: ChampsLus = {};
	const erreurs: Record<string, string> = {};

	for (const cle of Object.keys(OBLIGATOIRES) as (keyof typeof OBLIGATOIRES)[]) {
		if (valeurs[cle] === undefined) continue;
		const valeur = cle === 'email' ? normaliserAdresse(valeurs[cle]) : valeurs[cle].trim();
		if (!valeur) erreurs[cle] = OBLIGATOIRES[cle];
		else champs[cle] = valeur;
	}
	if (champs.email !== undefined) {
		if (!champs.email.includes('@')) erreurs.email = 'Adresse invalide';
		// Une fiche à l'adresse d'un super administrateur ferait de lui un agent du centre.
		else if (superAdmins.map(normaliserAdresse).includes(champs.email)) erreurs.email = 'Adresse réservée au super administrateur';
	}
	if (valeurs.telephone !== undefined) champs.telephone = valeurs.telephone.trim() || null;
	for (const cle of DATES) {
		if (valeurs[cle] === undefined) continue;
		if (valeurs[cle] === '') champs[cle] = null;
		else if (dateValide(valeurs[cle])) champs[cle] = valeurs[cle];
		else erreurs[cle] = 'Date invalide';
	}
	for (const cle of IDENTIFIANTS) {
		if (valeurs[cle] === undefined) continue;
		if (valeurs[cle] === '') champs[cle] = null;
		else if (/^\d+$/.test(valeurs[cle])) champs[cle] = Number(valeurs[cle]);
		else erreurs[cle] = 'Choix inconnu';
	}
	if (champs.profilId === null) erreurs.profilId = 'Choisissez un profil.';
	return { champs, erreurs, valeurs };
}

const CHAMP_DE_L_ERREUR: Record<string, string> = {
	'Adresse déjà utilisée': 'email',
	'Adresse vide': 'email',
	'Adresse invalide': 'email',
	'Prénom vide': 'prenom',
	'Prénom invalide': 'prenom',
	'Nom vide': 'nom',
	'Nom invalide': 'nom',
	'Grade inconnu': 'gradeId',
	'Profil inconnu': 'profilId',
	'Équipe inconnue': 'equipeId'
};

// Ce que reçoit la page après un envoi : carte concernée, message général, erreurs par champ, saisie à réafficher.
export type Reponse = { carte?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Record<string, string> };

// Traduit un refus du socle en réponse du formulaire ; toute autre erreur remonte.
export function echec(erreur: unknown, contexte: Reponse = {}) {
	if (erreur instanceof RefusDroit) return fail<Reponse>(403, { ...contexte, message: erreur.message });
	if (erreur instanceof DonneeInvalide) {
		const champ = CHAMP_DE_L_ERREUR[erreur.message];
		return fail<Reponse>(400, champ ? { ...contexte, erreurs: { [champ]: erreur.message } } : { ...contexte, message: erreur.message });
	}
	throw erreur;
}

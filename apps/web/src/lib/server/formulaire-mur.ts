import { error, fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, RefusDroit, type Acteur, type DonneesPublication } from '@gyro-caserne/socle';

const TAILLE_PHOTO_MAX = 400 * 1024;
// 4 photos de 400 Ko et 0,1 Mo pour le texte et les autres champs.
const ENVOI_MAX = 4 * TAILLE_PHOTO_MAX + 100 * 1024;

export function exigerActeur(locals: App.Locals): Acteur {
	if (!locals.acteur) redirect(303, '/connexion');
	return locals.acteur;
}

// Refus du socle en lecture : mur inconnu (404), non accessible (403), page invalide (400).
export function erreurLecture(erreur: unknown): never {
	if (erreur instanceof RefusDroit) error(403, 'Vous n’avez pas accès à ce mur');
	if (erreur instanceof DonneeInvalide) error(erreur.message === 'Page invalide' ? 400 : 404, erreur.message);
	throw erreur;
}

// Saisie à réafficher après un refus (les photos ne reviennent pas : il faut les choisir à nouveau).
export type Valeurs = { type?: string; texte?: string; priseDeConnaissance?: boolean; debut?: string; lieu?: string; equipes?: string[]; question?: string; reponses?: string[] };
export type Reponse = { cible: string; succes?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Valeurs };

const texte = (f: FormData, cle: string) => {
	const v = f.get(cle);
	return typeof v === 'string' ? v : '';
};

// Avant toute lecture du corps : un envoi sans longueur annoncée ou trop lourd est refusé, pour ne pas saturer la mémoire du serveur.
export function envoiTropLourd(request: Request): boolean {
	const longueur = Number(request.headers.get('content-length') ?? NaN);
	return !Number.isFinite(longueur) || longueur > ENVOI_MAX;
}

// Lit le formulaire « Publier » (corps déjà limité par envoiTropLourd). Une photo de plus de 400 Ko (envoyée sans JavaScript,
// donc sans réduction) est refusée avant d'être copiée pour le socle.
export async function lirePublication(f: FormData): Promise<{ donnees?: DonneesPublication; valeurs: Valeurs; erreurs?: Record<string, string> }> {
	const valeurs: Valeurs = {
		type: texte(f, 'type'),
		texte: texte(f, 'texte'),
		priseDeConnaissance: f.get('priseDeConnaissance') === 'oui',
		debut: texte(f, 'debut'),
		lieu: texte(f, 'lieu'),
		equipes: f.getAll('equipe').filter((v) => typeof v === 'string'),
		question: texte(f, 'question'),
		reponses: f.getAll('reponse').filter((v) => typeof v === 'string')
	};
	const fichiers = f.getAll('photos').filter((v): v is File => typeof v !== 'string' && v.size > 0);
	if (fichiers.some((p) => p.size > TAILLE_PHOTO_MAX))
		return { valeurs, erreurs: { photos: 'Photo trop lourde : 400 Ko au plus. Sans JavaScript, les photos ne sont pas réduites : réduisez-les avant de les envoyer.' } };

	// Le socle refuse un type inconnu.
	const type = valeurs.type as DonneesPublication['type'];
	const reponses = valeurs.reponses!.map((r) => r.trim()).filter(Boolean);
	const donnees: DonneesPublication = { type, texte: valeurs.texte!, priseDeConnaissance: type === 'annonce' && valeurs.priseDeConnaissance };
	if (valeurs.question!.trim() || reponses.length > 0) donnees.sondage = { question: valeurs.question!, reponses };
	// Les champs d'un événement ne comptent que pour un événement (la case de prise de connaissance, que pour une annonce) ; aucune équipe cochée : tout le mur.
	if (type === 'evenement') donnees.evenement = { debut: valeurs.debut!, lieu: valeurs.lieu!, convoques: valeurs.equipes!.length > 0 ? valeurs.equipes!.map(Number) : 'tous' };
	if (fichiers.length > 0) donnees.photos = await Promise.all(fichiers.map(async (p) => ({ type: p.type, donnees: new Uint8Array(await p.arrayBuffer()) })));
	return { donnees, valeurs };
}

// Message du socle -> champ du formulaire et phrase claire. Un message absent de la table s'affiche tel quel.
const DONNEES: Record<string, { champ?: string; texte: string }> = {
	'Texte vide': { champ: 'texte', texte: 'Écrivez le texte de la publication.' },
	'Texte trop long': { champ: 'texte', texte: 'Le texte ne peut pas dépasser 4 000 caractères.' },
	'Type inconnu': { champ: 'type', texte: 'Choisissez le type de publication.' },
	'Prise de connaissance réservée aux annonces': { champ: 'type', texte: 'La prise de connaissance ne se demande que pour une annonce.' },
	'4 photos au plus': { champ: 'photos', texte: '4 photos au plus.' },
	'Photo JPEG ou WebP seulement': { champ: 'photos', texte: 'Les photos doivent être en JPEG ou WebP.' },
	'Photo trop lourde (400 Ko au plus)': { champ: 'photos', texte: 'Photo trop lourde : 400 Ko au plus.' },
	'Question vide': { champ: 'sondage', texte: 'Indiquez la question du sondage.' },
	'Question trop longue': { champ: 'sondage', texte: 'La question ne peut pas dépasser 200 caractères.' },
	'Réponse trop longue': { champ: 'sondage', texte: 'Une réponse ne peut pas dépasser 100 caractères.' },
	'De 2 à 6 réponses': { champ: 'sondage', texte: 'Proposez de 2 à 6 réponses.' },
	'Date et lieu de l’événement manquants': { champ: 'debut', texte: 'Indiquez la date et l’heure.' },
	'Début invalide': { champ: 'debut', texte: 'Indiquez la date et l’heure.' },
	'Événement passé': { champ: 'debut', texte: 'Cet événement est déjà passé.' },
	'Lieu vide': { champ: 'lieu', texte: 'Indiquez le lieu.' },
	'Lieu trop long': { champ: 'lieu', texte: 'Le lieu ne peut pas dépasser 200 caractères.' },
	'Convoqués invalides': { champ: 'convoques', texte: 'Choisissez les équipes convoquées.' },
	'Équipe inconnue': { champ: 'convoques', texte: 'Une des équipes choisies n’existe pas.' },
	'Publication inconnue': { texte: 'Cette publication n’existe plus.' }
};

// Traduit un refus du socle en réponse du formulaire visé ; toute autre erreur remonte.
export function echecMur(erreur: unknown, cible: string, valeurs?: Valeurs) {
	if (erreur instanceof RefusDroit) {
		const message =
			cible !== 'publier'
				? 'Vous n’avez pas le droit de faire cela.'
				: erreur.droit === 'MODERER_SALON'
					? 'Seuls les modérateurs du mur demandent une prise de connaissance.'
					: 'Vous ne pouvez pas publier sur ce mur.';
		return fail<Reponse>(403, { cible, message, valeurs });
	}
	if (erreur instanceof DonneeInvalide) {
		const connu = DONNEES[erreur.message];
		// Hors du formulaire « Publier », pas de champ : le message s'affiche sous la publication.
		if (connu?.champ && cible === 'publier') return fail<Reponse>(400, { cible, erreurs: { [connu.champ]: connu.texte }, valeurs });
		return fail<Reponse>(400, { cible, message: connu?.texte ?? erreur.message, valeurs });
	}
	throw erreur;
}

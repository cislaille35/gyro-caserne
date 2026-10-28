import { error, fail, redirect } from '@sveltejs/kit';
import { asc, isNull } from 'drizzle-orm';
import { aLeDroit, comite, DonneeInvalide, RefusDroit, type Acteur, type Attributeur } from '@gyro-caserne/socle';
import { DOMAINES, type DomaineId } from '#lib/paquets.ts';

const CENTRE = { type: 'centre' } as const;

// Qui peut quoi sur le centre : comités (GERER_COMITES), responsabilités (GERER_LISTES), pouvoir (GERER_ACCES ou super).
export async function accesReglages(locals: App.Locals, aujourdhui: string) {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const [comites, listes, pouvoir] = await Promise.all([
		aLeDroit(base, acteur, 'GERER_COMITES', CENTRE, aujourdhui),
		aLeDroit(base, acteur, 'GERER_LISTES', CENTRE, aujourdhui),
		acteur.type === 'super' ? true : aLeDroit(base, acteur, 'GERER_ACCES', CENTRE, aujourdhui)
	]);
	if (!comites && !listes) error(403, 'Accès réservé à qui gère les comités ou les responsabilités du centre');
	return { acteur: acteur as Acteur, base, comites, listes, pouvoir };
}

export function texte(formulaire: FormData, cle: string): string | undefined {
	const brut = formulaire.get(cle);
	return typeof brut === 'string' ? brut : undefined;
}

export function numero(brut: string | undefined): number | null {
	return brut !== undefined && /^\d+$/.test(brut) ? Number(brut) : null;
}

export function attributeurDe(brut: string | undefined): Attributeur | null {
	if (brut === 'chef_centre' || brut === 'comite_vise') return { type: brut };
	const comite = /^comite:(\d+)$/.exec(brut ?? '');
	return comite ? { type: 'comite', id: Number(comite[1]) } : null;
}

// Le niveau choisi par domaine ; « sur_mesure » ou absent : le domaine n'est pas touché.
export function niveauxChoisis(formulaire: FormData): Partial<Record<DomaineId, number>> {
	const choix: Partial<Record<DomaineId, number>> = {};
	for (const d of DOMAINES) {
		const n = numero(texte(formulaire, `niveau-${d.id}`));
		if (n !== null && n < d.niveaux.length) choix[d.id] = n;
	}
	return choix;
}

// Les comités qui peuvent attribuer un rôle (non dissous), même sans le droit de gérer les comités.
export async function comitesChoix(base: App.Locals['base']) {
	return base.select({ id: comite.id, nom: comite.nom }).from(comite).where(isNull(comite.dissousLe)).orderBy(asc(comite.nom));
}

// Ce que reçoit la page après un envoi. `cible` dit quel formulaire est concerné (role, detail, archiver…) : le message s'affiche à côté.
export type Valeurs = { nom?: string; theme?: string; nature?: string; portee?: string; attributeur?: string; icone?: string; droits?: string[] };
export type Reponse = { cible: string; succes?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Valeurs };

// Message du socle -> champ du formulaire et phrase claire. Un message absent de la table s'affiche tel quel.
const DONNEES: Record<string, { champ?: string; texte: string }> = {
	'Nom vide': { champ: 'nom', texte: 'Indiquez le nom.' },
	'Nom trop long': { champ: 'nom', texte: 'Le nom ne peut pas dépasser 60 caractères.' },
	'Nom déjà utilisé': { champ: 'nom', texte: 'Ce nom est déjà utilisé (les majuscules et les espaces autour ne comptent pas).' },
	'Thème vide': { champ: 'theme', texte: 'Indiquez le thème.' },
	'Thème trop long': { champ: 'theme', texte: 'Le thème ne peut pas dépasser 60 caractères.' },
	'Le comité du centre ne se renomme pas': { champ: 'nom', texte: 'Le comité du centre ne se renomme pas.' },
	'Le comité du centre ne se dissout pas': { texte: 'Le comité du centre ne se dissout pas.' },
	'Comité inconnu': { texte: 'Ce comité n’existe pas.' },
	'Comité dissous': { texte: 'Ce comité est dissous : il ne peut plus servir ni être modifié.' },
	'Comité déjà dissous': { texte: 'Ce comité est déjà dissous.' },
	'Nature inconnue': { champ: 'nature', texte: 'Choisissez la nature : fonction ou mission.' },
	'Portée inconnue': { champ: 'portee', texte: 'Choisissez la portée : centre, équipe ou comité.' },
	'Droit inconnu': { champ: 'droits', texte: 'Un des droits envoyés n’existe pas.' },
	'Attributeur inconnu': { champ: 'attributeur', texte: 'Choisissez qui attribue cette responsabilité.' },
	'Seule une responsabilité de portée « comité » est attribuée par le comité visé': { champ: 'attributeur', texte: 'Le comité visé n’attribue qu’une responsabilité de portée « comité ».' },
	'Une responsabilité de portée « comité » est attribuée par le comité visé ou par un comité désigné': {
		champ: 'attributeur',
		texte: 'Une responsabilité de portée « comité » est attribuée par le comité visé ou par un comité désigné, pas par le chef de centre.'
	},
	'Responsabilité inconnue': { texte: 'Cette responsabilité n’existe pas.' },
	'Responsabilité archivée': { texte: 'Cette responsabilité est archivée : elle ne peut plus être modifiée.' },
	'Responsabilité déjà archivée': { texte: 'Cette responsabilité est déjà archivée.' },
	'La portée d’une responsabilité système ne change pas': { champ: 'portee', texte: 'La portée d’une responsabilité système ne change pas.' },
	'Portée verrouillée : la responsabilité est tenue': { champ: 'portee', texte: 'La portée ne change pas tant que quelqu’un tient ou tiendra cette responsabilité.' },
	'Droit verrouillé : impossible de le retirer': { champ: 'droits', texte: 'Un droit verrouillé ne se retire pas.' },
	'Une responsabilité système ne s’archive pas': { texte: 'Une responsabilité système (chef de centre, adjoint, chef d’équipe) ne s’archive pas.' },
	'Icône inconnue': { champ: 'icone', texte: 'Choisissez une icône de la liste.' },
	'Modèle inconnu': { texte: 'Ce modèle n’existe pas : choisissez-en un dans la liste.' },
	'Profil inconnu': { texte: 'Ce profil n’existe pas.' },
	'Un profil ne donne pas de droit de pouvoir': { texte: 'Un profil ne donne pas de droit d’administration.' }
};

const REFUS = [
	['Seuls le chef de centre ou un super administrateur donnent un droit de pouvoir', 'Seuls le chef de centre, son adjoint ou un super administrateur ajoutent ou retirent un droit de pouvoir.'],
	['Seuls le chef de centre ou un super administrateur modifient une responsabilité qui donne un droit de pouvoir', 'Seuls le chef de centre, son adjoint ou un super administrateur modifient ou archivent une responsabilité qui donne un droit de pouvoir.']
] as const;

function refus(erreur: RefusDroit): string {
	const connu = REFUS.find(([brut]) => brut === erreur.message);
	if (connu) return connu[1];
	if (erreur.droit === 'GERER_COMITES') return 'Vous n’avez pas le droit de gérer les comités.';
	if (erreur.droit === 'GERER_LISTES') return 'Vous n’avez pas le droit de gérer les responsabilités.';
	return 'Vous n’avez pas le droit de faire cette action.';
}

// Traduit un refus du socle en réponse du bon formulaire ; toute autre erreur remonte.
export function echec(erreur: unknown, cible: string, valeurs?: Valeurs) {
	if (erreur instanceof RefusDroit) return fail<Reponse>(403, { cible, message: refus(erreur), valeurs });
	if (erreur instanceof DonneeInvalide) {
		const connu = DONNEES[erreur.message];
		if (connu?.champ) return fail<Reponse>(400, { cible, erreurs: { [connu.champ]: connu.texte }, valeurs });
		return fail<Reponse>(400, { cible, message: connu?.texte ?? erreur.message, valeurs });
	}
	throw erreur;
}

export function manque(cible: string, message: string, valeurs?: Valeurs) {
	return fail<Reponse>(400, { cible, message, valeurs });
}

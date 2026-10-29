import { fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, envoyer, modifierMessage, reagir, RefusDroit, signaler, supprimerMessage, TAILLE_PHOTO_MAX, type Acteur, type Reaction } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { avecJavaScript, envoiTropLourd, exigerActeur } from './formulaire-mur.ts';

// `cible` : la saisie (« envoyer ») ou un geste sur un message. `valeurs` : la saisie à réafficher (sans les photos).
export type ReponseMessage = { cible: 'envoyer' | 'geste'; message?: string; succes?: string; valeurs?: { texte: string; reponseA: string } };

// Message du socle -> phrase claire. Un message absent de la table s'affiche tel quel.
const DONNEES: Record<string, string> = {
	'Message vide': 'Écrivez votre message.',
	'Message trop long': 'Le message ne peut pas dépasser 4 000 caractères.',
	'Message cité introuvable': 'Le message cité n’existe plus.',
	'Réponse invalide': 'Le message cité n’existe plus.',
	'Conversation en lecture seule': 'Cette conversation ne sert plus qu’à relire.',
	'Cette personne n’est pas dans l’annuaire': 'Cette personne n’est plus dans l’annuaire.',
	'4 photos au plus': '4 photos au plus.',
	'Photo JPEG ou WebP seulement': 'Les photos doivent être en JPEG ou WebP.',
	'Photo trop lourde (200 Ko au plus)': 'Photo trop lourde : 200 Ko au plus.',
	'Réaction inconnue': 'Choisissez une des six réactions.',
	'Pas de réaction sur ce message': 'Ce message ne prend pas de réaction.',
	'Modifiable 15 minutes après l’envoi': 'Un message se modifie dans les 15 minutes après l’envoi.',
	'Message supprimé': 'Ce message a été supprimé.',
	'Message déjà supprimé': 'Ce message est déjà supprimé.',
	'Ce message ne peut pas être signalé': 'Ce message ne peut pas être signalé.',
	'Vous ne pouvez pas signaler votre propre message': 'Vous ne pouvez pas signaler votre propre message.',
	'Message déjà signalé': 'Vous avez déjà signalé ce message.',
	'Message invalide': 'Ce message n’existe plus.'
};

const REFUS: Record<string, string> = {
	'Conversation non accessible': 'Vous ne faites plus partie de ce groupe.',
	'Réservé à l’auteur du message': 'Seul l’auteur du message peut faire cela.'
};

// Traduit un refus du socle ; toute autre erreur remonte.
export function echecMessagerie(erreur: unknown, cible: ReponseMessage['cible'], valeurs?: ReponseMessage['valeurs']) {
	if (erreur instanceof RefusDroit) return fail<ReponseMessage>(403, { cible, message: REFUS[erreur.message] ?? 'Vous n’avez pas le droit de faire cela.', valeurs });
	if (erreur instanceof DonneeInvalide) return fail<ReponseMessage>(400, { cible, message: DONNEES[erreur.message] ?? `${erreur.message}.`, valeurs });
	throw erreur;
}

const texte = (f: FormData, cle: string) => {
	const v = f.get(cle);
	return typeof v === 'string' ? v : '';
};
const entier = (f: FormData, cle: string) => {
	const v = texte(f, cle);
	return /^\d+$/.test(v) ? Number(v) : null;
};

// « Envoyer » : à une conversation, ou à une personne (la conversation naît alors). Sans JavaScript, la page se recharge sur
// le message envoyé ; avec, l'appli reste sur place et relance le rafraîchissement.
export async function actionEnvoyer(locals: App.Locals, request: Request, cible: { conversation: number } | { personne: number }) {
	const acteur = exigerActeur(locals);
	const js = avecJavaScript(request);
	if (envoiTropLourd(request)) return fail<ReponseMessage>(413, { cible: 'envoyer', message: `Envoi trop lourd : 4 photos de 200 Ko au plus.${js ? '' : ' Sans JavaScript, réduisez vos photos avant de les envoyer.'}` });
	const f = await request.formData();
	const valeurs = { texte: texte(f, 'texte'), reponseA: texte(f, 'reponseA') };
	const fichiers = f.getAll('photos').filter((v): v is File => typeof v !== 'string' && v.size > 0);
	if (fichiers.some((p) => p.size > TAILLE_PHOTO_MAX))
		return fail<ReponseMessage>(400, { cible: 'envoyer', message: `Photo trop lourde : 200 Ko au plus.${js ? '' : ' Sans JavaScript, les photos ne sont pas réduites : réduisez-les avant de les envoyer.'}`, valeurs });
	const reponseA = valeurs.reponseA ? (entier(f, 'reponseA') ?? -1) : undefined;
	let envoi: { conversation: number; message: number };
	try {
		const photos = await Promise.all(fichiers.map(async (p) => ({ type: p.type, donnees: new Uint8Array(await p.arrayBuffer()) })));
		envoi = await envoyer(locals.base, locals.basePhotos, acteur, cible, { texte: valeurs.texte, reponseA, photos }, maintenantParis());
	} catch (erreur) {
		return echecMessagerie(erreur, 'envoyer', valeurs);
	}
	redirect(303, `/echanges/messages/${envoi.conversation}#message-${envoi.message}`);
}

// Un geste sur un message (réagir, modifier, supprimer, signaler) : la phrase de réussite, ou le refus.
async function geste(locals: App.Locals, request: Request, faire: (acteur: Acteur, id: number, f: FormData) => Promise<string>) {
	const acteur = exigerActeur(locals);
	const f = await request.formData();
	const id = entier(f, 'id');
	if (id === null) return fail<ReponseMessage>(400, { cible: 'geste', message: 'Ce message n’existe plus.' });
	try {
		return { cible: 'geste', succes: await faire(acteur, id, f) } satisfies ReponseMessage;
	} catch (erreur) {
		return echecMessagerie(erreur, 'geste');
	}
}

type Requete = { locals: App.Locals; request: Request };

export const actionsDeGestes = {
	reagir: ({ locals, request }: Requete) =>
		geste(locals, request, async (acteur, id, f) => {
			await reagir(locals.base, acteur, id, texte(f, 'emoji') as Reaction, maintenantParis());
			return 'Réaction enregistrée.';
		}),
	modifier: ({ locals, request }: Requete) =>
		geste(locals, request, async (acteur, id, f) => {
			await modifierMessage(locals.base, acteur, id, texte(f, 'texte'), maintenantParis());
			return 'Message modifié.';
		}),
	supprimer: ({ locals, request }: Requete) =>
		geste(locals, request, async (acteur, id) => {
			await supprimerMessage(locals.base, locals.basePhotos, acteur, id, maintenantParis());
			return 'Message supprimé.';
		}),
	signaler: ({ locals, request }: Requete) =>
		geste(locals, request, async (acteur, id) => {
			await signaler(locals.base, acteur, id, maintenantParis());
			return 'Le message a été transmis à la modération.';
		})
};

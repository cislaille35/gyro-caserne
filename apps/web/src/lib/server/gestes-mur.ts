import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
	aimer,
	commentaire,
	commenter,
	DonneeInvalide,
	fermerCommentaires,
	prendreConnaissance,
	publication,
	repondreEvenement,
	supprimerCommentaire,
	voter,
	type Acteur
} from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { echecMur, exigerActeur, type Reponse, type Valeurs } from './formulaire-mur.ts';

type Requete = { locals: App.Locals; params: { mur: string }; request: Request };

// Un identifiant envoyé par un formulaire ; null s'il n'en est pas un.
const entier = (f: FormData, cle: string) => {
	const brut = f.get(cle);
	return typeof brut === 'string' && /^\d+$/.test(brut) ? Number(brut) : null;
};
const texte = (f: FormData, cle: string) => {
	const v = f.get(cle);
	return typeof v === 'string' ? v : '';
};

// Une publication visée depuis la page d'un mur doit être de ce mur ; sinon, elle n'existe pas ici.
export async function surPublication(
	{ locals, params, request }: Requete,
	faire: (acteur: Acteur, id: number, f: FormData) => Promise<string>,
	valeurs?: (f: FormData) => Valeurs
) {
	const acteur = exigerActeur(locals);
	const f = await request.formData();
	const id = entier(f, 'id');
	if (id === null) return fail<Reponse>(400, { cible: 'publication', message: 'Cette publication n’existe plus.' });
	const cible = `publication:${id}`;
	const [ligne] = await locals.base.select({ mur: publication.mur }).from(publication).where(eq(publication.id, id));
	if (ligne?.mur !== params.mur) return fail<Reponse>(404, { cible, message: 'Cette publication n’existe plus.' });
	try {
		return { cible, succes: await faire(acteur, id, f) } satisfies Reponse;
	} catch (erreur) {
		return echecMur(erreur, cible, valeurs?.(f));
	}
}

const LIBELLES = { present: 'présent', absent: 'absent', incertain: 'incertain' } as Record<string, string>;

// Les gestes sur une publication, depuis son mur ou sa page.
export const gestes = {
	commenter: (r: Requete) =>
		surPublication(
			r,
			async (acteur, id, f) => {
				await commenter(r.locals.base, acteur, id, texte(f, 'texte'), maintenantParis());
				return 'Commentaire publié.';
			},
			(f) => ({ texte: texte(f, 'texte') })
		),
	supprimerCommentaire: (r: Requete) =>
		surPublication(r, async (acteur, id, f) => {
			const idCommentaire = entier(f, 'commentaire');
			const [ligne] = idCommentaire === null ? [] : await r.locals.base.select({ publicationId: commentaire.publicationId }).from(commentaire).where(eq(commentaire.id, idCommentaire));
			if (ligne?.publicationId !== id) throw new DonneeInvalide('Commentaire inconnu');
			await supprimerCommentaire(r.locals.base, acteur, idCommentaire!, maintenantParis());
			return 'Commentaire supprimé.';
		}),
	aimer: (r: Requete) =>
		surPublication(r, async (acteur, id, f) => {
			const oui = f.get('oui') === '1';
			await aimer(r.locals.base, acteur, id, oui, maintenantParis().slice(0, 10));
			return oui ? 'Vous aimez cette publication.' : 'J’aime retiré.';
		}),
	repondre: (r: Requete) =>
		surPublication(r, async (acteur, id, f) => {
			const reponse = texte(f, 'reponse');
			// Le socle refuse une réponse inconnue.
			await repondreEvenement(r.locals.base, acteur, id, reponse as 'present', maintenantParis().slice(0, 10));
			return `Réponse enregistrée : ${LIBELLES[reponse]}.`;
		}),
	voter: (r: Requete) =>
		surPublication(r, async (acteur, id, f) => {
			await voter(r.locals.base, acteur, id, entier(f, 'reponse') ?? -1, maintenantParis().slice(0, 10));
			return 'Vote enregistré.';
		}),
	prendreConnaissance: (r: Requete) =>
		surPublication(r, async (acteur, id) => {
			await prendreConnaissance(r.locals.base, acteur, id, maintenantParis());
			return 'Prise de connaissance enregistrée.';
		}),
	fermerCommentaires: (r: Requete) =>
		surPublication(r, async (acteur, id, f) => {
			const oui = f.get('oui') === '1';
			await fermerCommentaires(r.locals.base, acteur, id, oui, maintenantParis());
			return oui ? 'Commentaires fermés.' : 'Commentaires rouverts.';
		})
};

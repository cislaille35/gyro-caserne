import { courrielsDeDemande, resumeErreur, type DemandeACourriel } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';

// L'e-mail d'une nouvelle demande à ceux qui la reçoivent en notification (référents, ou à défaut le chef et l'adjoint), après la réponse,
// comme le lien de connexion. Texte simple : le titre, ses deux lignes, le lien. Un échec (adresse refusée, Brevo en panne) est écrit
// au journal, résumé ; la demande est déjà enregistrée et l'agent n'en sait rien.
// `adresse` : celle de la requête, pour un lien absolu.
export function envoyerDemandeParCourriel(locals: App.Locals, adresse: URL | string, demande: DemandeACourriel): void {
	const envoyer = locals.courriel;
	if (!envoyer) return;
	const origine = typeof adresse === 'string' ? adresse : adresse.origin;
	const travail = async () => {
		for (const c of await courrielsDeDemande(locals.base, demande, aujourdhuiParis())) {
			await envoyer({ a: c.a, sujet: c.titre, texte: `${c.titre}\n${c.texte}\n\n${origine}${c.url}\n` }).catch((e) => console.error('Courriel de demande non envoyé', resumeErreur(e)));
		}
	};
	locals.enArrierePlan?.(travail().catch((e) => console.error('Courriel de demande non envoyé', resumeErreur(e))));
}

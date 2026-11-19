// Une ligne au journal de Cloudflare par requête, écrite avant le travail (décision 0037) : le nom générique de la page
// (/agents/[id]), jamais son adresse ni une valeur venue de la requête. Elle dit quelle page une coupure a frappée.

// Les actions des formulaires de l'appli (?/souhaiter). Liste fermée, tenue à jour par page-au-journal.test.ts.
export const ACTIONS = new Set(
	'abandonner accepter aimer ajouter ajuster annuler aptitude archiver attribuer changer classer code commencer commenter couper courriel creer deconnecter deconnecterPartout default deplacer deposer desister detail dissoudre effacer enregistrer envoyer epingler equipe fermerCommentaires fete fiche finir geste modifier nommer nouveauType oterAptitude ouvrir prendreConnaissance proposer proposition publier quitter reactiver reagir refuser refuserApresCoup refuserValidation regler relancer renommer repondre retirer retirerVacances revenir roulement semaines signaler souhaiter statut supprimer supprimerCommentaire terminer toutCouper toutLete toutLu urgences vacances valider voter'.split(' ')
);
const METHODES = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

type Requete = { request: Request; url: URL; route: { id: string | null } };

// « Page GET /agents/[id] », « Page POST /echanges?/souhaiter », « Page GET /api/auth » ou « Page GET (aucune) ».
export function lignePage({ request, url, route }: Requete, deBetterAuth: boolean): string {
	const methode = METHODES.has(request.method) ? request.method : 'autre';
	// Le modèle de la page vient du code de l'appli (ses dossiers de pages), pas de la requête.
	const page = route.id ?? (deBetterAuth ? '/api/auth' : '(aucune)');
	let action = '';
	if (methode === 'POST' && route.id) {
		const nom = [...url.searchParams.keys()].find((k) => k.startsWith('/'))?.slice(1);
		if (nom !== undefined) action = `?/${ACTIONS.has(nom) ? nom : '(inconnue)'}`;
	}
	return `Page ${methode} ${page}${action}`;
}

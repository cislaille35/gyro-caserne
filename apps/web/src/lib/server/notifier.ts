// Les notifications partent après la réponse (waitUntil) : la publication, le commentaire ou le message de l'auteur
// n'attend jamais et n'échoue jamais à cause d'elles. Une erreur est écrite dans la console par son nom seul : son message
// peut porter le texte (les paramètres de la requête).
export function enArrierePlan(locals: App.Locals, travail: () => Promise<unknown>): void {
	const tache = travail().catch((erreur) => console.error('Notifications non créées', erreur instanceof Error ? erreur.name : typeof erreur));
	locals.enArrierePlan?.(tache);
}

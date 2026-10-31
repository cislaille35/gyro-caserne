// Les notifications partent après la réponse (waitUntil) : la publication, le commentaire ou le message de l'auteur
// n'attend jamais et n'échoue jamais à cause d'elles. Une erreur est écrite dans la console, sans le texte.
export function enArrierePlan(locals: App.Locals, travail: () => Promise<unknown>): void {
	const tache = travail().catch((erreur) => console.error('Notifications non créées', erreur));
	locals.enArrierePlan?.(tache);
}

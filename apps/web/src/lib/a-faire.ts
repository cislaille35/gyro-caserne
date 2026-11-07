import type { ANePasManquer } from '@gyro-caserne/socle';

// Chaque publication une seule fois : un événement porte son sondage ouvert, une épinglée déjà listée n'est pas répétée.
export function regrouper(a: ANePasManquer) {
	const evenements = a.evenements.map((e) => ({ ...e, sondage: a.sondages.some((s) => s.id === e.id) }));
	const sondages = a.sondages.filter((s) => !a.evenements.some((e) => e.id === s.id));
	const listees = [...a.annonces, ...evenements, ...sondages];
	return { ...a, evenements, sondages, epinglees: a.epinglees.filter((e) => !listees.some((i) => i.id === e.id)) };
}

// Ce qui attend un geste de la personne (la cloche) : annonces à prendre en compte, événements à venir sans réponse ou avec
// un sondage ouvert, sondages ouverts. Un événement en cours n'attend plus de réponse.
export function aFaire(a: ANePasManquer) {
	const { annonces, evenements, sondages } = regrouper(a);
	return { annonces, evenements: evenements.filter((e) => (e.reponse === null && !e.enCours) || e.sondage), sondages };
}

export const nombreAFaire = (a: ANePasManquer) => {
	const { annonces, evenements, sondages } = aFaire(a);
	return annonces.length + evenements.length + sondages.length;
};

import { aNePasManquer, type Acteur, type ANePasManquer } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';

export const aNePasManquerDe = (base: App.Locals['base'], acteur: Acteur) => aNePasManquer(base, acteur, aujourdhuiParis(), maintenantParis());

// Ce qui attend un geste de la personne (la cloche) : annonces à prendre en compte, événements sans réponse, sondages ouverts.
export function aFaire({ annonces, evenements, sondages }: ANePasManquer) {
	return { annonces, evenements: evenements.filter((e) => e.reponse === null), sondages };
}

export const nombreAFaire = (a: ANePasManquer) => {
	const { annonces, evenements, sondages } = aFaire(a);
	return annonces.length + evenements.length + sondages.length;
};

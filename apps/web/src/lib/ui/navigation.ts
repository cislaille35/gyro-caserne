export type EntreeNavigation = { href: string; libelle: string; icone: string };

const accueil = { href: '/', libelle: 'Accueil', icone: 'accueil' };
const agents = { href: '/agents', libelle: 'Agents', icone: 'agents' };
const connexion = { href: '/connexion', libelle: 'Connexion', icone: 'connexion' };
const affichage = { href: '/affichage', libelle: 'Affichage', icone: 'affichage' };

export function entreesNavigation(connecte: boolean): EntreeNavigation[] {
	return connecte ? [accueil, agents, affichage] : [connexion, affichage];
}

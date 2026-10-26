export type EntreeNavigation = { href: string; libelle: string; icone: string };

const accueil = { href: '/', libelle: 'Accueil', icone: 'accueil' };
const agents = { href: '/agents', libelle: 'Agents', icone: 'agents' };
const profil = { href: '/profil', libelle: 'Mon profil', icone: 'profil' };
const connexion = { href: '/connexion', libelle: 'Connexion', icone: 'connexion' };
const affichage = { href: '/affichage', libelle: 'Affichage', icone: 'affichage' };

// Le super administrateur est connecté sans fiche : pas de « Mon profil ».
export function entreesNavigation(connecte: boolean, estPersonne = false): EntreeNavigation[] {
	if (!connecte) return [connexion, affichage];
	return [accueil, agents, ...(estPersonne ? [profil] : []), affichage];
}

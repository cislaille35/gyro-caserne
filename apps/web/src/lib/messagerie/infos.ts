export type GesteMembre = { cle: 'ecrire' | 'nommer' | 'retirer'; libelle: string; danger?: boolean };

// « Groupe, 4 membres, créé par Romain ».
export function resumeGroupe(g: { membres: number; creePar: number; creeParPrenom: string | null }, moi: number): string {
	const createur = g.creePar === moi ? 'vous' : g.creeParPrenom;
	return ['Groupe', `${g.membres} membre${g.membres > 1 ? 's' : ''}`, createur && `créé par ${createur}`].filter(Boolean).join(', ');
}

// Le menu d'un membre : écrire pour tous ; nommer et retirer pour les animateurs.
export function gestesMembre(m: { prenom: string; animateur: boolean }, moiAnimateur: boolean): GesteMembre[] {
	const gestes: GesteMembre[] = [{ cle: 'ecrire', libelle: `Écrire à ${m.prenom}` }];
	if (!moiAnimateur) return gestes;
	if (!m.animateur) gestes.push({ cle: 'nommer', libelle: 'Nommer animateur' });
	gestes.push({ cle: 'retirer', libelle: 'Retirer du groupe', danger: true });
	return gestes;
}

const EXTRAIT = 80;

// Les n premiers caractères, sans jamais couper un emoji en deux.
export const debut = (texte: string, n: number) => Array.from(texte).slice(0, n).join('');

// « Répondre en privé » : le champ commence par le début de la publication.
export function aPropos(brut: string | null): string {
	const propre = (brut ?? '').replace(/\s+/g, ' ').trim();
	if (!propre) return '';
	const coupe = debut(propre, EXTRAIT);
	const extrait = coupe.length < propre.length ? `${coupe.trimEnd()}…` : propre;
	return `À propos de « ${extrait} » : `;
}

// Un brouillon déjà là reste, sous le début de la publication.
export function avecBrouillon(prerempli: string, brouillon: string): string {
	if (!prerempli || brouillon.startsWith(prerempli)) return brouillon || prerempli;
	return brouillon ? `${prerempli}\n${brouillon}` : prerempli;
}

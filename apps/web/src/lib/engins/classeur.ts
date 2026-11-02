import type { DonneesFichierFiches, FichierFichesLu } from '@gyro-caserne/socle';
import readXlsxFile from 'read-excel-file/universal';
import writeXlsxFile, { type Cell, type Feature, type Sheet } from 'write-excel-file/universal';

// Le classeur des fiches : une feuille par type d'engin (Réf., Zone, Élément, Quantité), la ligne d'en-tête figée.
const texte = (valeur: string): Cell => (valeur === '' ? null : { value: valeur, type: String });

function cellule(entete: string, valeur: string): Cell {
	if ((entete === 'Réf.' || entete === 'Quantité') && /^\d+$/.test(valeur)) return { value: Number(valeur), type: Number };
	return texte(valeur);
}

const LARGEURS: Record<string, number> = { 'Réf.': 8, Zone: 26, Élément: 52, Quantité: 11 };

export async function ecrireClasseurFiches(donnees: DonneesFichierFiches): Promise<Blob> {
	// Seules des lignes sont figées : le volet actif est celui du bas à gauche, sinon Excel propose de réparer le fichier.
	const retouches: Feature<Blob> = {
		files: {
			transform: {
				'xl/worksheets/sheet{id}.xml': {
					transform: (xml) => xml.replace(/<pane [^>]*\/>/, '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>')
				}
			}
		}
	};
	const feuilles: Sheet<Blob>[] = donnees.feuilles.map((f) => ({
		sheet: f.nom,
		stickyRowsCount: 1,
		columns: donnees.entetes.map((e) => ({ width: LARGEURS[e] ?? 14 })),
		data: [donnees.entetes.map((e) => ({ value: e, type: String, fontWeight: 'bold' as const })), ...f.lignes.map((l) => donnees.entetes.map((e, i) => cellule(e, l[i] ?? '')))]
	}));
	return writeXlsxFile(feuilles, { features: [retouches] }).toBlob();
}

type Valeur = string | number | boolean | Date | null;
const enTexte = (v: Valeur) => (v === null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

// Toutes les feuilles, lignes non vides numérotées comme dans le tableur.
export async function lireClasseurFiches(fichier: Blob): Promise<FichierFichesLu> {
	const lu: FichierFichesLu = { feuilles: {}, entetes: {} };
	for (const f of await readXlsxFile(fichier)) {
		const [ligneEntetes = [], ...suite] = f.data as Valeur[][];
		// Les quatre colonnes de l'export seulement : une colonne de notes ajoutée à droite est ignorée.
		const entetes = ligneEntetes.slice(0, 4).map(enTexte);
		lu.entetes![f.sheet] = entetes;
		lu.feuilles[f.sheet] = suite.map((ligne, i) => ({ numero: i + 2, cellules: entetes.map((_, colonne) => enTexte(ligne[colonne] ?? null)) })).filter((l) => l.cellules.some((c) => c !== ''));
	}
	return lu;
}

export const nomDuFichierFiches = (aujourdhui: string) => `fiches-engins-${aujourdhui}.xlsx`;

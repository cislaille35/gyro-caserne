import { dateFichier, dateIso, type DonneesFichier, type FichierLu, type Repere } from '@gyro-caserne/socle';
import readXlsxFile from 'read-excel-file/universal';
import writeXlsxFile, { type Cell, type Feature, type Row, type Sheet } from 'write-excel-file/universal';
import { getCellAddress, getOrderOfSiblings, insertElementMarkupAccordingToOrderOfSiblings } from 'write-excel-file/utility';

const COLONNES_DATE = ['Date de grade', 'Naissance', 'Entrée au centre', 'Engagement SPV'];
// Listes déroulantes posées jusqu'à cette ligne du tableur.
const DERNIERE_LIGNE = 1000;

type CleListe = keyof DonneesFichier['listes'] | 'oui';
const ORDRE_LISTES: CleListe[] = ['grades', 'equipes', 'statuts', 'profils', 'rolesComite', 'oui'];

const texte = (valeur: string): Cell => (valeur === '' ? null : { value: valeur, type: String });

function cellule(entete: string, valeur: string): Cell {
	// Format texte : un numéro tapé garde son 0 de tête.
	if (entete === 'Téléphone') return { value: valeur || undefined, type: String, format: '@' };
	if (entete === 'N°' && /^\d+$/.test(valeur)) return { value: Number(valeur), type: Number };
	const iso = COLONNES_DATE.includes(entete) ? dateIso(valeur) : null;
	if (iso) return { value: new Date(`${iso}T00:00:00Z`), type: Date, format: 'dd/mm/yyyy' };
	return texte(valeur);
}

export async function ecrireClasseur(donnees: DonneesFichier): Promise<Blob> {
	// Feuille « Listes » : une colonne par liste, dans l'ordre de ORDRE_LISTES.
	const listes = ORDRE_LISTES.map((cle) => (cle === 'oui' ? ['Oui'] : donnees.listes[cle]));
	const hauteur = Math.max(...listes.map((l) => l.length));
	const lignesListes: Row[] = Array.from({ length: hauteur }, (_, i) => listes.map((l) => texte(l[i] ?? '')));

	const validations = donnees.entetes.flatMap((entete, colonne) => {
		const cle = donnees.colonnesListe[entete];
		if (!cle) return [];
		const rang = ORDRE_LISTES.indexOf(cle);
		const valeurs = listes[rang]!;
		if (valeurs.length === 0) return [];
		const lettre = getCellAddress(0, rang).slice(0, -1);
		const plage = `${getCellAddress(1, colonne)}:${getCellAddress(DERNIERE_LIGNE - 1, colonne)}`;
		return [`<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${plage}"><formula1>Listes!$${lettre}$1:$${lettre}$${valeurs.length}</formula1></dataValidation>`];
	});

	const listesDeroulantes: Feature<Blob> = {
		files: {
			transform: {
				'xl/worksheets/sheet{id}.xml': {
					transform(xml, _options, { sheetIndex }) {
						if (sheetIndex !== 0 || validations.length === 0) return xml;
						const bloc = `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`;
						return insertElementMarkupAccordingToOrderOfSiblings(xml, bloc, getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet')!, 'worksheet');
					}
				},
				'xl/workbook.xml': {
					// Feuilles annexes masquées.
					transformElementAttributes: (balise, attributs) =>
						balise === 'sheet' && attributs.name !== 'Effectif' ? { ...attributs, state: 'hidden' } : attributs
				}
			}
		}
	};

	// Lignes vides jusqu'à DERNIERE_LIGNE, pour que la colonne Téléphone y soit déjà en texte.
	const lignes = [...donnees.lignes, ...Array.from({ length: DERNIERE_LIGNE - 1 - donnees.lignes.length }, () => [])];
	const effectif: Row[] = [
		donnees.entetes.map((e) => ({ value: e, type: String, fontWeight: 'bold' as const })),
		...lignes.map((ligne: string[]) => donnees.entetes.map((entete, i) => cellule(entete, ligne[i] ?? '')))
	];
	const feuilles: Sheet<Blob>[] = [
		{ sheet: 'Effectif', data: effectif, stickyRowsCount: 1, columns: donnees.entetes.map((e) => ({ width: e === 'E-mail' ? 30 : Math.max(14, e.length + 2) })) },
		{ sheet: 'Listes', data: lignesListes }
	];
	const repere = donnees.repere;
	if (repere) {
		feuilles.push({ sheet: 'Repère', data: [[{ value: repere.journal, type: Number }, { value: repere.personne, type: Number }, texte(repere.date)]] });
	}
	return writeXlsxFile(feuilles, { features: [listesDeroulantes] }).toBlob();
}

type Valeur = string | number | boolean | Date | null;

function enTexte(valeur: Valeur, entete: string | undefined): string {
	if (valeur === null) return '';
	// Numéro français tapé en nombre : le tableur a mangé le 0.
	if (entete === 'Téléphone' && typeof valeur === 'number' && /^\d{9}$/.test(String(valeur))) return `0${valeur}`;
	if (valeur instanceof Date) {
		const deux = (n: number) => String(n).padStart(2, '0');
		return `${deux(valeur.getUTCDate())}/${deux(valeur.getUTCMonth() + 1)}/${valeur.getUTCFullYear()}`;
	}
	const brut = String(valeur).trim();
	// « 1/3/2024 » se lit comme « 01/03/2024 ».
	const iso = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(brut) ? dateIso(brut) : null;
	return iso ? dateFichier(iso) : brut;
}

function lireRepere(lignes: Valeur[][] | undefined): Repere | null {
	const [journal, personne, date] = lignes?.[0] ?? [];
	if (typeof journal !== 'number' || typeof personne !== 'number') return null;
	const jour = date instanceof Date ? date.toISOString().slice(0, 10) : typeof date === 'string' ? date.trim() : '';
	return /^\d{4}-\d{2}-\d{2}$/.test(jour) ? { journal, personne, date: jour } : null;
}

export async function lireClasseur(fichier: Blob): Promise<FichierLu> {
	const feuilles = await readXlsxFile(fichier);
	const lignesDe = (nom: string) => feuilles.find((f) => f.sheet === nom)?.data as Valeur[][] | undefined;
	const effectif = lignesDe('Effectif');
	if (!effectif) throw new Error('Feuille « Effectif » introuvable');

	const [ligneEntetes = [], ...suite] = effectif;
	const entetes = ligneEntetes.map((v) => enTexte(v, undefined));
	const lignes = suite
		.map((ligne, i) => ({ numero: i + 2, cellules: ligne.map((v, colonne) => enTexte(v, entetes[colonne])) }))
		.filter((l) => l.cellules.some((c) => c !== ''));
	return { entetes, lignes, repere: lireRepere(lignesDe('Repère')) };
}

export function nomDuFichier(modele: boolean, aujourdhui: string): string {
	return modele ? 'modele-effectif.xlsx' : `effectif-${aujourdhui}.xlsx`;
}

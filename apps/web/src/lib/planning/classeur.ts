import { dateFichier, dateIso, type DonneesFichierPlanning, type FichierPlanningLu } from '@gyro-caserne/socle';
import readXlsxFile from 'read-excel-file/universal';
import writeXlsxFile, { type Cell, type Feature, type Row, type Sheet } from 'write-excel-file/universal';
import { getCellAddress, getOrderOfSiblings, insertElementMarkupAccordingToOrderOfSiblings } from 'write-excel-file/utility';

// Le classeur du planning : une feuille par partie, les listes déroulantes dans une feuille « Listes » masquée.
const COLONNES_DATE = ['Du', 'Au', 'Date'];
const DERNIERE_LIGNE = 400;
const LISTES = 'Listes';

const texte = (valeur: string): Cell => (valeur === '' ? null : { value: valeur, type: String });

function cellule(entete: string, valeur: string): Cell {
	const iso = COLONNES_DATE.includes(entete) ? dateIso(valeur) : null;
	if (iso) return { value: new Date(`${iso}T00:00:00Z`), type: Date, format: 'dd/mm/yyyy' };
	// Format texte : « 08:30 » reste une heure lisible, « 1, 3 » une liste d'équipes.
	if (entete === 'Heure' || entete === 'Équipes' || entete === 'Réf.') return { value: valeur || undefined, type: String, format: '@' };
	return texte(valeur);
}

export async function ecrireClasseurPlanning(donnees: DonneesFichierPlanning): Promise<Blob> {
	// Une colonne de la feuille « Listes » par liste déroulante, dans l'ordre des feuilles.
	const listes = donnees.feuilles.flatMap((f, feuille) => Object.entries(f.listes).map(([colonne, valeurs]) => ({ feuille, colonne: f.entetes.indexOf(colonne), valeurs })));
	const hauteur = Math.max(1, ...listes.map((l) => l.valeurs.length));
	const lignesListes: Row[] = Array.from({ length: hauteur }, (_, i) => listes.map((l) => texte(l.valeurs[i] ?? '')));
	const validations = (feuille: number) =>
		listes.flatMap((l, rang) => {
			if (l.feuille !== feuille || l.colonne < 0 || l.valeurs.length === 0) return [];
			const lettre = getCellAddress(0, rang).slice(0, -1);
			const plage = `${getCellAddress(1, l.colonne)}:${getCellAddress(DERNIERE_LIGNE - 1, l.colonne)}`;
			return [`<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${plage}"><formula1>${LISTES}!$${lettre}$1:$${lettre}$${l.valeurs.length}</formula1></dataValidation>`];
		});

	const retouches: Feature<Blob> = {
		files: {
			transform: {
				'xl/worksheets/sheet{id}.xml': {
					transform(xml, _options, { sheetIndex }) {
						if (sheetIndex >= donnees.feuilles.length) return xml;
						// Seules des lignes sont figées : le volet actif est celui du bas à gauche, sinon Excel propose de réparer le fichier.
						const fige = xml.replace(/<pane [^>]*\/>/, '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>');
						const v = validations(sheetIndex);
						if (v.length === 0) return fige;
						const bloc = `<dataValidations count="${v.length}">${v.join('')}</dataValidations>`;
						return insertElementMarkupAccordingToOrderOfSiblings(fige, bloc, getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet')!, 'worksheet');
					}
				},
				'xl/workbook.xml': {
					transformElementAttributes: (balise, attributs) => (balise === 'sheet' && attributs.name === LISTES ? { ...attributs, state: 'hidden' } : attributs)
				}
			}
		}
	};

	const feuilles: Sheet<Blob>[] = donnees.feuilles.map((f) => ({
		sheet: f.nom,
		stickyRowsCount: 1,
		columns: f.entetes.map((e) => ({ width: e === 'Thème' || e === 'Lieu' || e === 'Nom' ? 28 : Math.max(12, e.length + 2) })),
		data: [f.entetes.map((e) => ({ value: e, type: String, fontWeight: 'bold' as const })), ...f.lignes.map((l) => f.entetes.map((e, i) => cellule(e, l[i] ?? '')))]
	}));
	feuilles.push({ sheet: LISTES, data: lignesListes });
	return writeXlsxFile(feuilles, { features: [retouches] }).toBlob();
}

type Valeur = string | number | boolean | Date | null;

function enTexte(valeur: Valeur, entete: string | undefined): string {
	if (valeur === null) return '';
	if (valeur instanceof Date) return dateFichier(valeur.toISOString().slice(0, 10));
	// Une heure tapée dans le tableur arrive en fraction de journée.
	if (entete === 'Heure' && typeof valeur === 'number' && valeur >= 0 && valeur < 1) {
		const minutes = Math.round(valeur * 24 * 60);
		return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
	}
	const brut = String(valeur).trim();
	const iso = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(brut) ? dateIso(brut) : null;
	return iso ? dateFichier(iso) : brut;
}

// Les feuilles connues, lignes non vides numérotées comme dans le tableur ; les autres feuilles sont ignorées.
export async function lireClasseurPlanning(fichier: Blob, noms: string[]): Promise<FichierPlanningLu> {
	const feuilles = await readXlsxFile(fichier);
	const lu: FichierPlanningLu = { feuilles: {} };
	for (const f of feuilles) {
		if (!noms.includes(f.sheet)) continue;
		const [ligneEntetes = [], ...suite] = f.data as Valeur[][];
		const entetes = ligneEntetes.map((v) => enTexte(v, undefined));
		(lu.entetes ??= {})[f.sheet] = entetes;
		lu.feuilles[f.sheet] = suite.map((ligne, i) => ({ numero: i + 2, cellules: entetes.map((e, colonne) => enTexte(ligne[colonne] ?? null, e)) })).filter((l) => l.cellules.some((c) => c !== ''));
	}
	if (Object.keys(lu.feuilles).length === 0) throw new Error('Aucune feuille du planning dans ce fichier');
	return lu;
}

export const nomDuFichierPlanning = (annee: number) => `planning-${annee}.xlsx`;

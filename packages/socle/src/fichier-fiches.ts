import type { Base } from './base.ts';
import type { Acteur } from './droits.ts';
import { DonneeInvalide } from './erreurs.ts';
import { ecrireOuRefuser, ecrituresFiche, exigerGestionEngins, LIMITES_FICHE, lireFiches, refsLibres, verifierZones, type Fiche, type ZoneFiche } from './fiches.ts';
import { ligneJournal } from './journal.ts';
import { nomActeur } from './actions/personnes.ts';

// Le fichier des fiches : une feuille par type d'engin, une ligne par élément, dans l'ordre de la fiche.
// « Réf. » garde le lien avec l'élément (anomalies à venir) ; une ligne sans « Réf. » est un nouvel élément ; une ligne retirée retire l'élément.

export const ENTETES_FICHES = ['Réf.', 'Zone', 'Élément', 'Quantité'] as const;

export type DonneesFichierFiches = { entetes: string[]; feuilles: { nom: string; lignes: string[][] }[] };
export type FichierFichesLu = { feuilles: Record<string, { numero: number; cellules: string[] }[]>; entetes?: Record<string, string[]> };
export type ChangementsFiche = { type: string; version: number; nouvelleVersion: boolean; ajoutes: string[]; retires: string[]; modifies: string[]; ordre: boolean };
export type ApercuFiches = { fiches: ChangementsFiche[]; erreurs: { feuille: string; ligne: number; message: string }[] };

export async function donneesFichierFiches(base: Base, acteur: Acteur, maintenant: string): Promise<DonneesFichierFiches> {
	await exigerGestionEngins(base, acteur, maintenant);
	const fiches = await lireFiches(base);
	return {
		entetes: [...ENTETES_FICHES],
		feuilles: fiches.map((f) => ({ nom: f.type, lignes: f.zones.flatMap((z) => z.elements.map((e) => [String(e.ref), z.nom, e.libelle, e.quantite === null ? '' : String(e.quantite)])) }))
	};
}

const memeNom = (a: string, b: string) => a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr');
const propre = (t: string) => t.trim().replace(/\s+/g, ' ');

// Une feuille → les zones de la fiche. Les zones gardent leur référence par leur nom, les éléments par leur « Réf. ».
function lireFeuille(fiche: Fiche, lignes: { numero: number; cellules: string[] }[], refs: { zone: number; element: number }, erreur: (ligne: number, message: string) => void): ZoneFiche[] {
	const zones: ZoneFiche[] = [];
	const connus = new Set(fiche.zones.flatMap((z) => z.elements.map((e) => e.ref)));
	const vues = new Set<number>();
	for (const { numero, cellules } of lignes) {
		const [refBrute = '', zoneBrute = '', libelleBrut = '', quantiteBrute = ''] = cellules.map(propre);
		if (!zoneBrute) {
			erreur(numero, 'Zone vide');
			continue;
		}
		if (!libelleBrut) {
			erreur(numero, 'Élément vide');
			continue;
		}
		if (zoneBrute.length > LIMITES_FICHE.nomZone) erreur(numero, `Zone trop longue (${LIMITES_FICHE.nomZone} caractères au plus)`);
		if (libelleBrut.length > LIMITES_FICHE.libelle) erreur(numero, `Élément trop long (${LIMITES_FICHE.libelle} caractères au plus)`);
		const quantite = quantiteBrute === '' ? null : Number(quantiteBrute);
		if (quantite !== null && !(Number.isInteger(quantite) && quantite >= 1 && quantite <= LIMITES_FICHE.quantite)) erreur(numero, `Quantité « ${quantiteBrute} » : un nombre entier de 1 à ${LIMITES_FICHE.quantite}, ou rien`);
		// Une « Réf. » inconnue de cette fiche (copiée d'une autre feuille, tapée à la main) : un nouvel élément.
		let ref = /^\d+$/.test(refBrute) && connus.has(Number(refBrute)) ? Number(refBrute) : null;
		if (ref !== null && vues.has(ref)) {
			erreur(numero, `Réf. ${ref} en double : effacez-la sur la copie`);
			ref = null;
		}
		if (ref !== null) vues.add(ref);
		let zone = zones.find((z) => memeNom(z.nom, zoneBrute));
		if (!zone) {
			zone = { ref: fiche.zones.find((z) => memeNom(z.nom, zoneBrute))?.ref ?? refs.zone++, nom: zoneBrute, elements: [] };
			zones.push(zone);
		}
		zone.elements.push({ ref: ref ?? refs.element++, libelle: libelleBrut, quantite });
	}
	return zones;
}

function changements(fiche: Fiche, zones: ZoneFiche[]): ChangementsFiche {
	const avant = fiche.zones.flatMap((z) => z.elements.map((e) => ({ ...e, zone: z.ref })));
	const apres = zones.flatMap((z) => z.elements.map((e) => ({ ...e, zone: z.ref })));
	const nomZone = new Map([...fiche.zones, ...zones].map((z) => [z.ref, z.nom]));
	const modifies = apres.flatMap((e) => {
		const a = avant.find((x) => x.ref === e.ref);
		if (!a || (a.libelle === e.libelle && a.quantite === e.quantite && a.zone === e.zone)) return [];
		return [a.zone !== e.zone ? `${e.libelle} (passe en ${nomZone.get(e.zone)})` : a.libelle !== e.libelle ? `${a.libelle} → ${e.libelle}` : `${e.libelle} : ${a.quantite ?? 'sans quantité'} → ${e.quantite ?? 'sans quantité'}`];
	});
	const ajoutes = apres.filter((e) => !avant.some((a) => a.ref === e.ref)).map((e) => e.libelle);
	const retires = avant.filter((e) => !apres.some((a) => a.ref === e.ref)).map((e) => e.libelle);
	// L'ordre : zones présentes des deux côtés, et éléments restés dans leur zone.
	const restes = new Set(apres.filter((e) => avant.some((a) => a.ref === e.ref && a.zone === e.zone)).map((e) => e.ref));
	const communes = (z: ZoneFiche[], autres: ZoneFiche[]) => z.filter((x) => autres.some((y) => y.ref === x.ref));
	const cle = (z: ZoneFiche[]) => JSON.stringify(z.map((x) => [x.ref, x.nom, x.elements.filter((e) => restes.has(e.ref)).map((e) => e.ref)]));
	const ordre = cle(communes(fiche.zones, zones)) !== cle(communes(zones, fiche.zones));
	const changee = ajoutes.length + retires.length + modifies.length > 0 || ordre;
	return { type: fiche.type, version: fiche.version.numero, nouvelleVersion: changee && fiche.version.utilisee, ajoutes, retires, modifies, ordre };
}

async function analyser(base: Base, acteur: Acteur, lu: FichierFichesLu, maintenant: string) {
	await exigerGestionEngins(base, acteur, maintenant);
	const [fiches, refs] = await Promise.all([lireFiches(base), refsLibres(base)]);
	const erreurs: ApercuFiches['erreurs'] = [];
	const resultats: { fiche: Fiche; zones: ZoneFiche[]; changements: ChangementsFiche }[] = [];
	const vues = new Set<number>();
	for (const [feuille, lignes] of Object.entries(lu.feuilles)) {
		const fiche = fiches.find((f) => memeNom(f.type, feuille));
		const erreur = (ligne: number, message: string) => erreurs.push({ feuille, ligne, message });
		if (fiche && vues.has(fiche.typeId)) {
			erreur(1, `Deux feuilles pour le type ${fiche.type}`);
			continue;
		}
		if (fiche) vues.add(fiche.typeId);
		if (!fiche) {
			erreur(1, `Type d’engin « ${feuille} » inconnu : créez-le d’abord dans l’appli (Fiches → Nouveau type)`);
			continue;
		}
		const lues = lu.entetes?.[feuille];
		if (lues && ENTETES_FICHES.some((t, i) => (lues[i] ?? '').trim() !== t)) {
			erreur(1, `Colonnes attendues, dans l’ordre : ${ENTETES_FICHES.join(', ')}`);
			continue;
		}
		if (lignes.length === 0) {
			erreur(2, 'Feuille vide : une fiche garde au moins un élément (retirez la feuille pour ne pas toucher à cette fiche)');
			continue;
		}
		const avantErreurs = erreurs.length;
		const zones = lireFeuille(fiche, lignes, refs, erreur);
		if (erreurs.length > avantErreurs) continue;
		try {
			verifierZones(zones);
		} catch (e) {
			if (!(e instanceof DonneeInvalide)) throw e;
			erreur(1, e.message === 'Trop de zones' ? `Plus de ${LIMITES_FICHE.zones} zones` : `Plus de ${LIMITES_FICHE.elements} éléments`);
			continue;
		}
		resultats.push({ fiche, zones, changements: changements(fiche, zones) });
	}
	return { erreurs, resultats };
}

// Rien n'est écrit : ce que l'import changerait, fiche par fiche.
export async function apercuFiches(base: Base, acteur: Acteur, lu: FichierFichesLu, maintenant: string): Promise<ApercuFiches> {
	const { erreurs, resultats } = await analyser(base, acteur, lu, maintenant);
	return { fiches: resultats.map((r) => r.changements), erreurs };
}

// Tout d'un bloc, ou rien s'il reste une erreur. Seules les fiches changées sont écrites.
export async function appliquerFiches(base: Base, acteur: Acteur, lu: FichierFichesLu, maintenant: string): Promise<void> {
	const { erreurs, resultats } = await analyser(base, acteur, lu, maintenant);
	if (erreurs.length) throw new DonneeInvalide('Le fichier contient des erreurs');
	const changees = resultats.filter((r) => r.changements.ajoutes.length + r.changements.retires.length + r.changements.modifies.length > 0 || r.changements.ordre);
	if (changees.length === 0) return;
	const auteur = nomActeur(acteur);
	await ecrireOuRefuser(() =>
		base.batch([
			ligneJournal(base, { acteur: auteur, action: 'importer_fiches', cibleType: 'type_engin', cibleId: null, details: { types: changees.map((r) => r.fiche.type) } }, maintenant),
			...(changees.flatMap((r) => ecrituresFiche(base, r.fiche, r.zones, auteur, maintenant)) as unknown as [ReturnType<typeof ligneJournal>])
		])
	);
}

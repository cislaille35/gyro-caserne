import centre from '$centre';
import { libelleEtape, LIBELLES_MOTIF, type EnginVu, type EtapeAnomalie, type MotifAttente } from '@gyro-caserne/socle';
import { pluriel } from '#lib/pluriel.ts';

// Ce qu'on dit d'un engin, à l'écrit : jamais par la seule couleur. « Avertissement » : disponible, avec une anomalie ouverte.
export const ETATS = { disponible: { texte: 'Disponible', ton: 'ok' }, avertissement: { texte: 'Avertissement', ton: 'alerte' }, indisponible: { texte: 'Indisponible', ton: 'danger' } } as const;
export const etatAffiche = (etat: EnginVu['etat'], ouvertes: number): keyof typeof ETATS => (etat === 'indisponible' ? 'indisponible' : ouvertes > 0 ? 'avertissement' : 'disponible');

// Où en est une anomalie, avec les libellés du centre : « En attente · au garage », « Close ».
export function texteEtape(a: { etape: EtapeAnomalie; motif: MotifAttente | null; closeLe?: string | null }): string {
	if (a.closeLe) return 'Close';
	const etape = libelleEtape(a.etape, centre.anomalies);
	return a.etape === 'en_attente' && a.motif ? `${etape} · ${LIBELLES_MOTIF[a.motif].toLocaleLowerCase('fr')}` : etape;
}
export const tonEtape = (a: { etape: EtapeAnomalie; closeLe?: string | null }): 'ok' | 'info' | 'alerte' => (a.closeLe ? 'ok' : a.etape === 'signalee' ? 'alerte' : 'info');

export function situationDe(e: Pick<EnginVu, 'situation' | 'provenance' | 'partiLe'>): string {
	if (e.situation === 'prete') return `Prêté au centre par ${e.provenance}`;
	if (e.situation === 'parti') return `Parti le ${dateCourte(e.partiLe ?? '')}`;
	return 'Au centre';
}

// Sous-ligne d'un engin : son type, sa plaque, et d'où il vient s'il est prêté.
export function sousLigne(e: EnginVu): string {
	return [e.type, e.immatriculation, e.situation === 'prete' ? `prêté par ${e.provenance}` : null].filter(Boolean).join(' · ');
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
// 'AAAA-MM-JJ…' → '2 nov. 2026'.
export function dateCourte(iso: string): string {
	const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
	return a && m && j ? `${j} ${MOIS[m - 1]} ${a}` : '';
}

export const compteFiche = (zones: { elements: unknown[] }[]) => `${pluriel(zones.length, 'zone')} · ${pluriel(zones.reduce((n, z) => n + z.elements.length, 0), 'élément')}`;

// « 2 ajoutés, 1 retiré, rangement changé » ; « Aucun changement ».
export function resumerFiche(c: { ajoutes: string[]; retires: string[]; modifies: string[]; ordre: boolean }): string {
	const morceaux = [
		c.ajoutes.length ? pluriel(c.ajoutes.length, 'élément ajouté', 'éléments ajoutés') : '',
		c.retires.length ? pluriel(c.retires.length, 'retiré', 'retirés') : '',
		c.modifies.length ? pluriel(c.modifies.length, 'modifié', 'modifiés') : '',
		c.ordre ? 'rangement changé' : ''
	].filter(Boolean);
	return morceaux.length ? morceaux.join(', ') : 'Aucun changement';
}

const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const jourDe = (iso: string) => JOURS[(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7]!;
// '…T18:40' → '18 h 40' ; '…T18:00' → '18 h'.
export const heureCourte = (iso: string) => `${Number(iso.slice(11, 13))} h${iso.slice(14, 16) === '00' ? '' : ` ${iso.slice(14, 16)}`}`;
// '2026-10-30T18:40' → 'ven. 18 h 40'.
export const jourHeure = (iso: string) => `${jourDe(iso)} ${heureCourte(iso)}`;
// '2026-10-30T18:00' → 'ven. 30 oct.'.
export const jourCourt = (iso: string) => `${jourDe(iso)} ${dateCourte(iso).replace(/ \d{4}$/, '')}`;

// « Équipe 2 » → « l’équipe 2 » ; un autre nom reste tel quel.
export const parEquipe = (nom: string) => (/^Équipe /.test(nom) ? `l’équipe ${nom.slice(7)}` : nom);

// La relève, en clair : « Relève du ven. 30 oct., équipe 2 ».
export const texteReleve = (r: { debut: string; equipe: { nom: string } | null }) => `Relève du ${jourCourt(r.debut)}${r.equipe ? `, ${r.equipe.nom.toLocaleLowerCase('fr')}` : ''}`;

type EtatPriseVu = { etat: 'en_cours' | 'validee'; valideeLe: string | null; equipe: string | null; par: string } | null;
// L'état de la prise d'un engin pour la relève : « Prise faite par l’équipe 2, ven. 18 h 40 », « Prise en cours (Alice Martin) », « Prise à faire ».
export function etatPrise(p: EtatPriseVu): { texte: string; ton: 'ok' | 'info' | 'alerte' } {
	if (p === null) return { texte: 'Prise à faire', ton: 'alerte' };
	if (p.etat === 'en_cours') return { texte: `Prise en cours (${p.par})`, ton: 'info' };
	return { texte: `Prise faite par ${p.equipe ? parEquipe(p.equipe) : p.par}, ${jourHeure(p.valideeLe ?? '')}`, ton: 'ok' };
}

export const GENRES = { manquant: 'Manquant', abime: 'Abîmé', a_remplacer: 'À remplacer' } as const;

// « Manquant : 1 sur 3 · sous le siège ».
export function texteEcart(e: { genre: keyof typeof GENRES; manque: number | null; note: string | null }, quantite: number | null = null): string {
	const nombre = e.genre === 'manquant' && e.manque !== null ? ` : ${e.manque}${quantite ? ` sur ${quantite}` : ''}` : '';
	return [`${GENRES[e.genre]}${nombre}`, e.note].filter(Boolean).join(' · ');
}

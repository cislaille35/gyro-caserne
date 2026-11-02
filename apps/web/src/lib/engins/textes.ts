import type { EnginVu } from '@gyro-caserne/socle';
import { pluriel } from '#lib/pluriel.ts';

// Ce qu'on dit d'un engin, à l'écrit : jamais par la seule couleur.
export const ETATS = { disponible: { texte: 'Disponible', ton: 'ok' }, indisponible: { texte: 'Indisponible', ton: 'danger' } } as const;

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

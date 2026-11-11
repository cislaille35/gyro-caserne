import { describe, expect, it, vi } from 'vitest';
import { ajouterJours } from '../src/dates.ts';
import { plier, versUtc } from '../src/planning/agenda.ts';

// Le fichier d'agenda doit rester identique, octet pour octet, à ce que donnaient les versions d'avant le lot « calcul 2 »
// (décision 0021) : elles servent ici de référence.
const formatParis = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function versUtcAvant(local: string): string {
	const horloge = (ms: number) => {
		const p = Object.fromEntries(formatParis.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
		return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
	};
	const voulu = Date.parse(`${local.slice(0, 16)}:00Z`);
	let t = voulu - 3_600_000;
	for (let i = 0; i < 3; i++) t += voulu - horloge(t);
	return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function plierAvant(ligne: string): string {
	const morceaux: string[] = [];
	let courant = '';
	let octets = 0;
	for (const c of ligne) {
		const n = new TextEncoder().encode(c).length;
		if (octets + n > (morceaux.length ? 74 : 75)) {
			morceaux.push(courant);
			courant = '';
			octets = 0;
		}
		courant += c;
		octets += n;
	}
	morceaux.push(courant);
	return morceaux.join('\r\n ');
}

const minutes = ['00', '01', '15', '29', '30', '45', '59'];
const heures = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));

describe('Agenda : heure de Paris vers UTC, identique à l’ancien calcul', () => {
	it('chaque heure de cinq années, changements d’heure compris', () => {
		let n = 0;
		for (let jour = '2025-01-01'; jour < '2030-01-01'; jour = ajouterJours(jour, 1))
			for (const h of heures) {
				const local = `${jour}T${h}:00`;
				expect(versUtc(local), local).toBe(versUtcAvant(local));
				n++;
			}
		expect(n).toBe(1826 * 24);
	});

	it('chaque minute utile des jours de changement d’heure, et de leurs veilles et lendemains', () => {
		for (const changement of ['2026-03-29', '2026-10-25', '2027-03-28', '2027-10-31', '2028-03-26', '2028-10-29'])
			for (const jour of [ajouterJours(changement, -1), changement, ajouterJours(changement, 1)])
				for (const h of heures)
					for (const mn of minutes) {
						const local = `${jour}T${h}:${mn}`;
						expect(versUtc(local), local).toBe(versUtcAvant(local));
					}
	});

	it('un jour sans changement d’heure ne demande que deux lectures de l’horloge de Paris', () => {
		const lire = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts');
		try {
			for (const h of heures) versUtc(`2031-05-14T${h}:30`);
			expect(lire.mock.calls.length).toBeLessThanOrEqual(2);
		} finally {
			lire.mockRestore();
		}
	});
});

describe('Agenda : lignes pliées à 75 octets, identiques à l’ancien pliage', () => {
	const lignes = [
		'',
		'BEGIN:VEVENT',
		`SUMMARY:${'a'.repeat(67)}`,
		`SUMMARY:${'a'.repeat(66)}`,
		`SUMMARY:${'a'.repeat(68)}`,
		`SUMMARY:${'a'.repeat(300)}`,
		`SUMMARY:Astreinte · Groupe A`,
		`SUMMARY:Manœuvre : désincarcération et feux de forêt, avec la caserne voisine et le SDIS`,
		`LOCATION:${'é'.repeat(80)}`,
		`DESCRIPTION:${'x'.repeat(65)}éé`,
		`DESCRIPTION:${'x'.repeat(66)}é${'y'.repeat(100)}`,
		`DESCRIPTION:${'🚒'.repeat(40)}`,
		`DESCRIPTION:${'x'.repeat(64)}🚒🚒${'€'.repeat(30)}`,
		`DESCRIPTION:demi \ud83d seul ${'z'.repeat(70)}`
	];
	it.each(lignes.map((l) => [l.length, l]))('ligne de %i caractères', (_, ligne) => {
		expect(plier(ligne)).toBe(plierAvant(ligne));
	});
});

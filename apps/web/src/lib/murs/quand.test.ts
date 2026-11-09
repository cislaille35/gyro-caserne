import { describe, expect, it } from 'vitest';
import { heure, jourEtHeure, periodeSondage, quand } from './quand.ts';

describe('quand', () => {
	const aujourdhui = '2026-10-29';
	it('aujourd’hui : l’heure', () => {
		expect(quand('2026-10-29T09:00:00', aujourdhui)).toBe('9 h');
		expect(quand('2026-10-29T14:05:00', aujourdhui)).toBe('14 h 05');
	});
	it('hier, puis le jour de la semaine, puis la date', () => {
		expect(quand('2026-10-28T23:00:00', aujourdhui)).toBe('hier');
		expect(quand('2026-10-26T10:00:00', aujourdhui)).toBe('lun.');
		expect(quand('2026-10-22T10:00:00', aujourdhui)).toBe('22 oct.');
	});
});

describe('dates d’un sondage', () => {
	it('« Du 29 oct. au lundi 2 nov., 20 h » et « Ouvre le … »', () => {
		expect(periodeSondage('2026-10-29T08:00', '2026-11-02T20:00')).toBe('Du 29 oct. au lundi 2 nov., 20 h');
		expect(periodeSondage('2026-10-29T08:00', '2026-11-02T20:30')).toBe('Du 29 oct. au lundi 2 nov., 20 h 30');
		// L'heure ne se coupe jamais en fin de ligne (« 18 h » / « 43 ») : espaces insécables.
		expect(jourEtHeure('2026-11-05T19:00')).toBe('jeudi 5 nov., 19 h');
		expect(jourEtHeure('2026-10-29T18:43')).toBe('jeudi 29 oct., 18 h 43');
	});
	it('l’heure seule', () => {
		expect(heure('2026-11-05T19:00')).toBe('19 h');
		expect(heure('2026-11-05T09:05')).toBe('9 h 05');
	});
});

describe('deNom : l’élision', () => {
	it('élide devant une voyelle, un accent ou un h', async () => {
		const { deNom } = await import('./quand.ts');
		expect(deNom('Antoine Adjoint')).toBe('d’Antoine Adjoint');
		expect(deNom('Élodie Martin')).toBe('d’Élodie Martin');
		expect(deNom('Hélène Roux')).toBe('d’Hélène Roux');
		expect(deNom('Claire Chef')).toBe('de Claire Chef');
	});
});

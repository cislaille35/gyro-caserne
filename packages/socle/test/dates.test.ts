import { describe, expect, it } from 'vitest';
import { enCours } from '../src/dates.ts';

describe('enCours', () => {
	it('inclut le dernier jour', () => {
		expect(enCours('2026-01-01', '2026-01-31', '2026-01-31')).toBe(true);
	});

	it('exclut une période qui n’a pas commencé', () => {
		expect(enCours('2026-02-01', null, '2026-01-31')).toBe(false);
	});

	it('garde une période sans fin', () => {
		expect(enCours('2026-01-01', null, '2030-01-01')).toBe(true);
	});

	it('inclut le premier jour', () => {
		expect(enCours('2026-01-01', null, '2026-01-01')).toBe(true);
	});

	it('exclut une période terminée', () => {
		expect(enCours('2026-01-01', '2026-01-31', '2026-02-01')).toBe(false);
	});
});

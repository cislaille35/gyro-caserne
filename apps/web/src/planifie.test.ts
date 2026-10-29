import { describe, expect, it, vi } from 'vitest';
import { effacerAnciens } from '@gyro-caserne/socle';
import { avecPlanifie, limiteDeConservation } from './planifie.ts';

vi.mock('@gyro-caserne/socle', async (original) => ({ ...(await original<typeof import('@gyro-caserne/socle')>()), effacerAnciens: vi.fn(async () => {}) }));

describe('limiteDeConservation', () => {
	it('le même jour, tant de mois plus tôt, à Paris', () => {
		expect(limiteDeConservation(new Date('2026-10-29T03:30:00Z'), 12)).toBe('2025-10-29');
		// 23 h 30 à Greenwich, mais déjà le lendemain à Paris.
		expect(limiteDeConservation(new Date('2026-10-28T23:30:00Z'), 12)).toBe('2025-10-29');
		expect(limiteDeConservation(new Date('2026-01-15T03:30:00Z'), 3)).toBe('2025-10-15');
	});

	it('un jour qui n’existe pas le mois visé devient le dernier du mois', () => {
		expect(limiteDeConservation(new Date('2026-03-31T03:30:00Z'), 1)).toBe('2026-02-28');
		expect(limiteDeConservation(new Date('2028-02-29T03:30:00Z'), 12)).toBe('2027-02-28');
	});
});

describe('avecPlanifie', () => {
	it('garde le fetch de SvelteKit et, chaque nuit, efface les messages plus anciens que la durée du centre', async () => {
		const kit = { fetch: vi.fn() };
		const worker = avecPlanifie(kit, { conservationMessagesMois: 6 });
		expect(worker.fetch).toBe(kit.fetch);

		const attendus: Promise<unknown>[] = [];
		const env = { BASE: {}, PHOTOS: {} } as never;
		worker.scheduled({ scheduledTime: Date.parse('2026-10-29T03:30:00Z') } as never, env, { waitUntil: (p: Promise<unknown>) => attendus.push(p) } as never);
		await Promise.all(attendus);
		expect(attendus).toHaveLength(1);
		expect(effacerAnciens).toHaveBeenCalledOnce();
		expect(vi.mocked(effacerAnciens).mock.calls[0]![2]).toBe('2026-04-29');
	});
});

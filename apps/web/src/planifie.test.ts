import { describe, expect, it, vi } from 'vitest';
import { effacerAnciens, effacerVieillesNotifications } from '@gyro-caserne/socle';
import { envoyerLot } from './lib/server/envoi-push.ts';
import { avecPlanifie, limiteDeConservation } from './planifie.ts';

vi.mock('@gyro-caserne/socle', async (original) => ({ ...(await original<typeof import('@gyro-caserne/socle')>()), effacerAnciens: vi.fn(async () => {}), effacerVieillesNotifications: vi.fn(async () => {}) }));
vi.mock('./lib/server/envoi-push.ts', () => ({ envoyerLot: vi.fn(async () => ({ envoyes: 0, perimes: 0 })) }));

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
	const lancer = async (cron: string, quand: string, env: Record<string, unknown> = {}) => {
		vi.clearAllMocks();
		const kit = { fetch: vi.fn() };
		const worker = avecPlanifie(kit, { conservationMessagesMois: 6 });
		expect(worker.fetch).toBe(kit.fetch);
		const attendus: Promise<unknown>[] = [];
		worker.scheduled({ cron, scheduledTime: Date.parse(quand) } as never, { BASE: {}, PHOTOS: {}, ...env } as never, { waitUntil: (p: Promise<unknown>) => attendus.push(p) } as never);
		await Promise.all(attendus);
		return attendus;
	};

	it('chaque nuit : messages plus anciens que la durée du centre, notifications de plus de 30 jours ; rien n’est envoyé', async () => {
		expect(await lancer('30 3 * * *', '2026-10-29T03:30:00Z')).toHaveLength(1);
		expect(vi.mocked(effacerAnciens).mock.calls[0]![2]).toBe('2026-04-29');
		expect(vi.mocked(effacerVieillesNotifications).mock.calls[0]![1]).toBe('2026-09-29');
		expect(envoyerLot).not.toHaveBeenCalled();
	});

	it('chaque minute : un lot d’envois au téléphone, avec les clés VAPID du centre (nulles sans secrets)', async () => {
		await lancer('* * * * *', '2026-10-29T10:01:00Z');
		expect(envoyerLot).toHaveBeenCalledOnce();
		expect(vi.mocked(envoyerLot).mock.calls[0]![1]).toBeNull();
		expect(effacerAnciens).not.toHaveBeenCalled();
	});
});

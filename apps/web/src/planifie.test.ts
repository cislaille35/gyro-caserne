import { describe, expect, it, vi } from 'vitest';
import { effacerAnciens, effacerVieillesNotifications, effacerVieillesReservations, mettreAJourReleves, planningDuMatin, rappelsEte, remplacementsDuMoment } from '@gyro-caserne/socle';
import { envoyerLot } from './lib/server/envoi-push.ts';
import { avecPlanifie, limiteDeConservation } from './planifie.ts';

vi.mock('@gyro-caserne/socle', async (original) => ({ ...(await original<typeof import('@gyro-caserne/socle')>()), effacerAnciens: vi.fn(async () => {}), effacerVieillesNotifications: vi.fn(async () => {}), effacerVieillesReservations: vi.fn(async () => {}), mettreAJourReleves: vi.fn(async () => {}), planningDuMatin: vi.fn(async () => ({ publiees: 0, relances: 0 })), rappelsEte: vi.fn(async () => 0), remplacementsDuMoment: vi.fn(async () => ({ expirees: 0, relances: 0 })) }));
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
		const worker = avecPlanifie(kit, { conservationMessagesMois: 6, position: { latitude: 48.1, longitude: -1.7 }, departement: '35' });
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
		// Les réservations finies depuis plus d'un an.
		expect(vi.mocked(effacerVieillesReservations).mock.calls[0]![1]).toBe('2025-10-29');
		expect(envoyerLot).not.toHaveBeenCalled();
	});

	it('chaque minute : un lot d’envois au téléphone, avec les clés VAPID du centre (nulles sans secrets)', async () => {
		await lancer('* * * * *', '2026-10-29T10:01:00Z');
		expect(envoyerLot).toHaveBeenCalledOnce();
		expect(vi.mocked(envoyerLot).mock.calls[0]![1]).toBeNull();
		expect(effacerAnciens).not.toHaveBeenCalled();
	});

	it('le matin, à 8 h et 8 h 10 à Paris : les manœuvres du planning (annonces et relances), pas la nuit', async () => {
		await lancer('* * * * *', '2026-11-15T07:00:00Z');
		expect(planningDuMatin).toHaveBeenCalledOnce();
		expect(vi.mocked(planningDuMatin).mock.calls[0]![1]).toBe('2026-11-15T08:00:00');
		// Les rappels des vacances d'été partent avec.
		expect(vi.mocked(rappelsEte).mock.calls[0]![1]).toBe('2026-11-15T08:00:00');
		await lancer('* * * * *', '2026-11-15T07:10:00Z');
		expect(planningDuMatin).toHaveBeenCalledOnce();
		expect(envoyerLot).toHaveBeenCalledOnce();
		for (const quand of ['2026-11-15T07:05:00Z', '2026-11-15T06:59:00Z', '2026-07-15T07:00:00Z']) {
			await lancer('* * * * *', quand);
			expect(planningDuMatin, quand).not.toHaveBeenCalled();
		}
		await lancer('30 3 * * *', '2026-11-15T03:30:00Z');
		expect(planningDuMatin).not.toHaveBeenCalled();
	});

	it('toutes les dix minutes : les remplacements (expirés, relancés la veille)', async () => {
		await lancer('* * * * *', '2026-11-15T09:20:00Z');
		expect(remplacementsDuMoment).toHaveBeenCalledOnce();
		expect(vi.mocked(remplacementsDuMoment).mock.calls[0]![1]).toBe('2026-11-15T10:20:00');
		await lancer('* * * * *', '2026-11-15T09:21:00Z');
		expect(remplacementsDuMoment).not.toHaveBeenCalled();
	});

	it('toutes les cinq minutes (à 0 et à 5) : la météo et la vigilance du centre (clé facultative)', async () => {
		await lancer('* * * * *', '2026-11-15T09:25:00Z', { VIGILANCE_CLE: 'cle-fictive' });
		expect(mettreAJourReleves).toHaveBeenCalledOnce();
		const [, lieu, maintenant, recuperer, cle] = vi.mocked(mettreAJourReleves).mock.calls[0]!;
		expect(lieu).toEqual({ position: { latitude: 48.1, longitude: -1.7 }, departement: '35' });
		expect(maintenant).toBe('2026-11-15T10:25');
		expect(typeof recuperer).toBe('function');
		expect(cle).toBe('cle-fictive');
		await lancer('* * * * *', '2026-11-15T09:25:00Z');
		expect(vi.mocked(mettreAJourReleves).mock.calls[0]![4]).toBeUndefined();
		await lancer('* * * * *', '2026-11-15T09:30:00Z');
		expect(mettreAJourReleves).toHaveBeenCalledOnce();
		for (const quand of ['2026-11-15T09:26:00Z', '2026-11-15T09:29:00Z']) {
			await lancer('* * * * *', quand);
			expect(mettreAJourReleves, quand).not.toHaveBeenCalled();
		}
		await lancer('30 3 * * *', '2026-11-15T03:35:00Z');
		expect(mettreAJourReleves).not.toHaveBeenCalled();
	});
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { suivreConversation } from './suite.ts';

function scene(reponses: (() => Response)[]) {
	const ecouteurs: (() => void)[] = [];
	const doc = {
		visibilityState: 'visible',
		addEventListener: (_: string, f: () => void) => ecouteurs.push(f),
		removeEventListener: vi.fn()
	};
	vi.stubGlobal('document', doc);
	let i = 0;
	const fetch = vi.fn(async () => (reponses[Math.min(i++, reponses.length - 1)] ?? (() => new Response('{}')))());
	vi.stubGlobal('fetch', fetch);
	const montrer = (visible: boolean) => {
		doc.visibilityState = visible ? 'visible' : 'hidden';
		ecouteurs.forEach((f) => f());
	};
	return { fetch, montrer };
}
const json = (corps: object, status = 200) => () => new Response(JSON.stringify(corps), { status });
const message = (id: number) => ({ id, texte: `M${id}` });

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('suivreConversation', () => {
	it('toutes les 4 s, page visible seulement, avec le repère reçu à chaque fois', async () => {
		vi.useFakeTimers();
		const { fetch, montrer } = scene([json({ nouveaux: [message(11), message(12)], modifies: [message(4)], majLe: '2026-10-29T10:00:05' }), json({ nouveaux: [], modifies: [], majLe: '2026-10-29T10:00:09' })]);
		const recus: unknown[] = [];
		const suivi = suivreConversation(7, { dernierId: 10, majLe: '2026-10-29T10:00:00' }, { recu: (n, m) => recus.push([n.map((x) => x.id), m.map((x) => x.id)]), exclu: () => {}, perime: () => {} });
		expect(fetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(4000);
		expect(fetch).toHaveBeenLastCalledWith('/echanges/messages/7/suite?dernier=10&maj=2026-10-29T10%3A00%3A00');
		expect(recus).toEqual([[[11, 12], [4]]]);
		await vi.advanceTimersByTimeAsync(4000);
		expect(fetch).toHaveBeenLastCalledWith('/echanges/messages/7/suite?dernier=12&maj=2026-10-29T10%3A00%3A05');
		// Rien de neuf : pas de rappel.
		expect(recus).toHaveLength(1);
		montrer(false);
		await vi.advanceTimersByTimeAsync(20_000);
		expect(fetch).toHaveBeenCalledTimes(2);
		// De retour sur la page : tout de suite.
		montrer(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetch).toHaveBeenCalledTimes(3);
		suivi.arreter();
		await vi.advanceTimersByTimeAsync(20_000);
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('chaque tour réussi est signalé, même sans rien de neuf (la date du jour se recalcule)', async () => {
		vi.useFakeTimers();
		scene([json({ nouveaux: [], modifies: [], majLe: '2026-10-29T10:00:05' })]);
		let tours = 0;
		const suivi = suivreConversation(7, { dernierId: 10, majLe: '2026-10-29T10:00:00' }, { recu: () => {}, exclu: () => {}, perime: () => {}, tour: () => tours++ });
		await vi.advanceTimersByTimeAsync(8000);
		expect(tours).toBe(2);
		suivi.arreter();
	});

	it('relancer : tout de suite, après un envoi', async () => {
		vi.useFakeTimers();
		const { fetch } = scene([json({ nouveaux: [message(11)], modifies: [], majLe: '2026-10-29T10:00:05' })]);
		const suivi = suivreConversation(7, { dernierId: 10, majLe: '2026-10-29T10:00:00' }, { recu: () => {}, exclu: () => {}, perime: () => {} });
		await suivi.relancer();
		expect(fetch).toHaveBeenCalledTimes(1);
		suivi.arreter();
	});

	it('403 : la personne ne fait plus partie du groupe, le suivi s’arrête', async () => {
		vi.useFakeTimers();
		const { fetch } = scene([json({ message: 'Vous ne faites plus partie de ce groupe.' }, 403)]);
		const exclus: string[] = [];
		suivreConversation(7, { dernierId: 10, majLe: '2026-10-29T10:00:00' }, { recu: () => {}, exclu: (m) => exclus.push(m), perime: () => {} });
		await vi.advanceTimersByTimeAsync(12_000);
		expect(exclus).toEqual(['Vous ne faites plus partie de ce groupe.']);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('chaque tour transmet le nombre de non-lus, pour la pastille', async () => {
		vi.useFakeTimers();
		scene([json({ nouveaux: [message(11)], modifies: [], majLe: '2026-10-29T10:00:05', nonLusTotal: 2 }), json({ nouveaux: [], modifies: [], majLe: '2026-10-29T10:00:09', nonLusTotal: 1 })]);
		const vus: number[] = [];
		const suivi = suivreConversation(7, { dernierId: 10, majLe: '2026-10-29T10:00:00' }, { recu: () => {}, exclu: () => {}, perime: () => {}, nonLus: (n) => vus.push(n) });
		await vi.advanceTimersByTimeAsync(8000);
		expect(vus).toEqual([2, 1]);
		suivi.arreter();
	});

	it('409 : le repère est trop ancien, le suivi s’arrête et la conversation est rechargée', async () => {
		vi.useFakeTimers();
		const { fetch } = scene([json({ message: 'Repère trop ancien' }, 409)]);
		let rechargements = 0;
		suivreConversation(7, { dernierId: 10, majLe: '2026-10-29T08:00:00' }, { recu: () => {}, exclu: () => {}, perime: () => rechargements++ });
		await vi.advanceTimersByTimeAsync(12_000);
		expect(rechargements).toBe(1);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('une panne passe sans bruit : le tour suivant réessaie', async () => {
		vi.useFakeTimers();
		const { fetch } = scene([
			() => {
				throw new TypeError('hors ligne');
			},
			json({ nouveaux: [], modifies: [], majLe: '2026-10-29T10:00:05' }, 500),
			json({ nouveaux: [message(11)], modifies: [], majLe: '2026-10-29T10:00:09' })
		]);
		const recus: number[] = [];
		suivreConversation(7, { dernierId: 10, majLe: '2026-10-29T10:00:00' }, { recu: (n) => recus.push(...n.map((x) => x.id)), exclu: () => {}, perime: () => {} });
		await vi.advanceTimersByTimeAsync(12_000);
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(fetch).toHaveBeenLastCalledWith('/echanges/messages/7/suite?dernier=10&maj=2026-10-29T10%3A00%3A00');
		expect(recus).toEqual([11]);
	});
});

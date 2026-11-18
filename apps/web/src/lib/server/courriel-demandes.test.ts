import { afterEach, describe, expect, it, vi } from 'vitest';
import { couper, demanderTenue } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { preparer } from '../../routes/echanges/de-test.ts';
import { envoyerDemandeParCourriel } from './courriel-demandes.ts';

afterEach(() => vi.restoreAllMocks());

// Le chef de centre du jeu commun reçoit les demandes d'habillement : aucun référent n'est nommé.
async function jeu(courriel: (m: { a: string; sujet: string; texte: string }) => Promise<void>) {
	const { base, chef, alice } = await preparer();
	const taches: Promise<unknown>[] = [];
	const locals = { base, courriel, enArrierePlan: (t: Promise<unknown>) => taches.push(t) } as unknown as App.Locals;
	return { base, chef, alice, locals, fini: () => Promise.all(taches) };
}

describe('envoyerDemandeParCourriel', () => {
	it('après la réponse, un e-mail par destinataire : le titre en sujet, ses deux lignes et le lien absolu, en texte simple', async () => {
		const envoyes: { a: string; sujet: string; texte: string }[] = [];
		const j = await jeu(async (m) => void envoyes.push(m));
		const id = await demanderTenue(j.base, j.alice, 'Rangers 43', '2026-11-18T10:00');
		envoyerDemandeParCourriel(j.locals, 'https://caserne.exemple.fr', { genre: 'habillement', id });
		expect(envoyes).toEqual([]);
		await j.fini();
		expect(envoyes).toEqual([{ a: 'chef@exemple.fr', sujet: 'Nouvelle demande d’habillement', texte: `Nouvelle demande d’habillement\nAlice Test : Rangers 43\n\nhttps://caserne.exemple.fr/habillement/${id}\n` }]);
	});

	it('« Recevoir les demandes par e-mail » coupé : rien', async () => {
		const envoyer = vi.fn(async () => {});
		const j = await jeu(envoyer);
		await couper(j.base, j.chef, 'courriel', true, '2026-11-18T09:00');
		envoyerDemandeParCourriel(j.locals, 'https://x', { genre: 'habillement', id: await demanderTenue(j.base, j.alice, 'Gants', '2026-11-18T10:00') });
		await j.fini();
		expect(envoyer).not.toHaveBeenCalled();
	});

	it('Brevo en échec ou base illisible : écrit au journal, résumé, sans jamais remonter', async () => {
		const journal = vi.spyOn(console, 'error').mockImplementation(() => {});
		const j = await jeu(async () => {
			throw new Error('Courriel refusé par Brevo (401) : Key not found');
		});
		envoyerDemandeParCourriel(j.locals, 'https://x', { genre: 'habillement', id: await demanderTenue(j.base, j.alice, 'Gants', '2026-11-18T10:00') });
		await expect(j.fini()).resolves.toBeDefined();
		expect(journal).toHaveBeenCalledWith('Courriel de demande non envoyé', expect.stringContaining('Brevo'));
		const cassee = await baseDeTest();
		const l = { base: { ...cassee, select: () => { throw new Error('panne'); } }, courriel: vi.fn(), enArrierePlan: (t: Promise<unknown>) => void t } as unknown as App.Locals;
		expect(() => envoyerDemandeParCourriel(l, 'https://x', { genre: 'habillement', id: 1 })).not.toThrow();
	});

	it('sans moyen d’envoi (tests, développement sans hooks) : rien', () => {
		expect(() => envoyerDemandeParCourriel({ enArrierePlan: () => {} } as unknown as App.Locals, 'https://x', { genre: 'habillement', id: 1 })).not.toThrow();
	});
});

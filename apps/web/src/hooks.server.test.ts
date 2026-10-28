import { describe, expect, it, vi } from 'vitest';
import { ENTETES } from '@gyro-caserne/socle';
import { envoiRefuse } from '#lib/server/taille-envoi.ts';
import { handle } from './hooks.server.ts';

const MO = 1024 * 1024;
const envoi = (longueur: number | null, type = 'application/x-www-form-urlencoded', methode = 'POST') => {
	const request = new Request('http://x/echanges/vie', { method: methode, body: 'x', headers: { 'content-type': type } });
	if (longueur === null) request.headers.delete('content-length');
	else request.headers.set('content-length', String(longueur));
	return request;
};

describe('taille des envois, pour toutes les routes', () => {
	it('refuse en 413, avant toute lecture, un envoi sans longueur ou de plus de 2 Mo', async () => {
		const sans = envoiRefuse(envoi(null), '/echanges/vie');
		expect(sans?.status).toBe(413);
		expect(await sans!.text()).toBe('Envoi trop lourd : 2 Mo au plus.');
		expect(envoiRefuse(envoi(2 * MO + 1), '/echanges/vie')?.status).toBe(413);
		expect(envoiRefuse(envoi(-1), '/echanges/vie')?.status).toBe(413);
		expect(envoiRefuse(envoi(2 * MO), '/echanges/vie')).toBeNull();
		for (const methode of ['PUT', 'PATCH', 'DELETE']) expect(envoiRefuse(envoi(3 * MO, 'text/plain', methode), '/x')?.status).toBe(413);
	});

	it('laisse passer les lectures et les envois sans corps', () => {
		expect(envoiRefuse(new Request('http://x/'), '/')).toBeNull();
		expect(envoiRefuse(new Request('http://x/', { method: 'HEAD' }), '/')).toBeNull();
		expect(envoiRefuse(new Request('http://x/deconnexion', { method: 'POST' }), '/deconnexion')).toBeNull();
	});

	it('aperçu du fichier des agents : 4 Mo, réponse en JSON', async () => {
		expect(envoiRefuse(envoi(3 * MO, 'application/json'), '/agents/fichier/apercu')).toBeNull();
		const refus = envoiRefuse(envoi(4 * MO + 1, 'application/json'), '/agents/fichier/apercu');
		expect(refus?.status).toBe(413);
		expect(await refus!.json()).toEqual({ message: 'Envoi trop lourd : 4 Mo au plus.' });
		expect(envoiRefuse(envoi(3 * MO, 'application/json'), '/agents/fichier/operation')?.status).toBe(413);
	});

	it('un fichier de 2 000 lignes aux champs les plus longs, avec 20 colonnes de rôles, tient dans la limite de l’aperçu', () => {
		const cellules = ['99999', `${'é'.repeat(126)}@x.fr`, 'é'.repeat(60), 'é'.repeat(60), 'Lieutenant hors classe', '01/06/2020', 'Équipe 12', 'Inapte temporaire', 'Chef de centre adjoint', '+33 6 12 34 56 78 9', '12/03/1985', '01/09/2005', '01/09/2005', ...Array<string>(20).fill('Trésorier adjoint')];
		const entetes = [...ENTETES, ...Array.from({ length: 20 }, (_, i) => `Comité : Comité n° ${i}`)];
		const corps = JSON.stringify({ entetes, lignes: Array.from({ length: 2000 }, (_, i) => ({ numero: i + 2, cellules })), repere: { journal: 123456, personne: 2345, date: '2026-10-28' } });
		const longueur = new TextEncoder().encode(corps).byteLength;
		expect(longueur).toBeGreaterThan(2 * MO);
		expect(envoiRefuse(envoi(longueur, 'application/json'), '/agents/fichier/apercu')).toBeNull();
	});

	it('appliquée par les hooks avant la session et la route', async () => {
		const resolve = vi.fn();
		const event = { request: envoi(5 * MO), url: new URL('http://x/echanges/vie'), cookies: { get: () => undefined }, locals: {} };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const reponse = await handle({ event: event as any, resolve });
		expect(reponse.status).toBe(413);
		expect(resolve).not.toHaveBeenCalled();
	});
});

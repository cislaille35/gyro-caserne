import { describe, expect, it } from 'vitest';
import { ACTIONS, lignePage } from './page-au-journal.ts';

const ligne = (adresse: string, route: string | null, methode = 'GET', deBetterAuth = false) => {
	const url = new URL(adresse, 'https://gyro.exemple.fr');
	return lignePage({ request: new Request(url, { method: methode }), url, route: { id: route } }, deBetterAuth);
};

describe('lignePage', () => {
	it('donne la méthode et le modèle de la page, jamais son adresse', () => {
		expect(ligne('/agents/42?onglet=fiche', '/agents/[id]')).toBe('Page GET /agents/[id]');
		expect(ligne('/agenda/ZxkQmPvRtLwBnCaaaaaaaaaa.ics', '/agenda/[fichier]')).toBe('Page GET /agenda/[fichier]');
		expect(ligne('/agents/42/__data.json?x-sveltekit-invalidated=01', '/agents/[id]')).toBe('Page GET /agents/[id]');
	});

	it('ajoute l’action d’un formulaire, si elle est connue', () => {
		expect(ligne('/echanges?/souhaiter', '/echanges', 'POST')).toBe('Page POST /echanges?/souhaiter');
		expect(ligne('/remplacements/demander', '/remplacements/demander', 'POST')).toBe('Page POST /remplacements/demander');
		expect(ligne('/echanges?/alice@exemple.fr', '/echanges', 'POST')).toBe('Page POST /echanges?/(inconnue)');
		// Une lecture ne porte pas d'action.
		expect(ligne('/echanges?/souhaiter', '/echanges')).toBe('Page GET /echanges');
	});

	it('range une requête sans page dans une catégorie fixe', () => {
		expect(ligne('/api/auth/magic-link/verify?token=abcdefghijklmnopqrstuvwxyz', null, 'GET', true)).toBe('Page GET /api/auth');
		expect(ligne('/api/auth/sign-in/magic-link?/souhaiter', null, 'POST', true)).toBe('Page POST /api/auth');
		expect(ligne('/n-existe/pas/alice@exemple.fr', null)).toBe('Page GET (aucune)');
	});

	it('ne recopie jamais une méthode inhabituelle', () => {
		expect(ligne('/', '/', 'PROPFIND')).toBe('Page autre /');
	});

	it('ne laisse passer aucune valeur venue de la requête', () => {
		const secrets = ['42', 'alice@exemple.fr', 'ZxkQmPvRtLwBnCaaaaaaaaaa', 'jeton-secret', 'Dupont'];
		const adresses = [
			'/agents/42?courriel=alice@exemple.fr',
			'/agenda/ZxkQmPvRtLwBnCaaaaaaaaaa.ics',
			'/echanges/messages/a/alice@exemple.fr?/Dupont',
			'/api/auth/magic-link/verify?token=jeton-secret',
			'/x?/jeton-secret&/42'
		];
		for (const adresse of adresses)
			for (const route of ['/agents/[id]', null])
				for (const methode of ['GET', 'POST', 'jeton-secret'])
					for (const deBetterAuth of [true, false]) {
						const resultat = ligne(adresse, route, methode, deBetterAuth);
						for (const secret of secrets) expect(resultat).not.toContain(secret);
						expect(resultat).toMatch(/^Page (GET|POST|autre) (\/agents\/\[id\]|\/api\/auth|\(aucune\))(\?\/(\w+|\(inconnue\)))?$/);
					}
	});
});

// La liste fermée des actions est exactement celle des pages de l'appli.
describe('ACTIONS', () => {
	it('suit les actions des formulaires de l’appli', () => {
		const pages = import.meta.glob<{ actions?: Record<string, unknown> }>('../../routes/**/+page.server.ts', { eager: true });
		const noms = new Set(Object.values(pages).flatMap((page) => Object.keys(page.actions ?? {})));
		expect(noms.size).toBeGreaterThan(50);
		expect([...ACTIONS].sort()).toEqual([...noms].sort());
	});
});

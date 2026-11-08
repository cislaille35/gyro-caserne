import { describe, expect, it } from 'vitest';
import { controleDeVie, controler, nomsDesSecrets, reglagesManquants } from '../scripts/controle-deploiement.ts';

const tous = ['BETTER_AUTH_SECRET', 'SUPER_ADMINS', 'BREVO_CLE'];
const adresse = { BETTER_AUTH_URL: 'https://appli.exemple' };

describe('reglagesManquants', () => {
	it('ne signale rien quand les trois secrets et l’adresse sont là', () => {
		expect(reglagesManquants(tous, adresse)).toEqual([]);
	});

	it('accepte l’adresse posée en secret plutôt que dans la config', () => {
		expect(reglagesManquants([...tous, 'BETTER_AUTH_URL'], {})).toEqual([]);
	});

	it('signale chaque réglage manquant, par son nom', () => {
		expect(reglagesManquants([], {})).toEqual(['BETTER_AUTH_SECRET', 'SUPER_ADMINS', 'BREVO_CLE', 'BETTER_AUTH_URL']);
		expect(reglagesManquants(['BETTER_AUTH_SECRET', 'BREVO_CLE'], adresse)).toEqual(['SUPER_ADMINS']);
	});

	it('ne prend pas une adresse vide pour une adresse', () => {
		expect(reglagesManquants(tous, { BETTER_AUTH_URL: '' })).toEqual(['BETTER_AUTH_URL']);
	});
});

describe('nomsDesSecrets', () => {
	it('ne garde que les noms de la liste de Wrangler', () => {
		expect(nomsDesSecrets('[{"name":"BREVO_CLE","type":"secret_text"},{"name":"SUPER_ADMINS","type":"secret_text"}]')).toEqual(['BREVO_CLE', 'SUPER_ADMINS']);
		expect(nomsDesSecrets('[]')).toEqual([]);
	});

	it('refuse une réponse illisible, sans la recopier', () => {
		for (const texte of ['pas du json valeur-secrete', '{"name":"X"}', '[{"type":"secret_text"}]']) {
			expect(() => nomsDesSecrets(texte)).toThrow('Liste des secrets illisible');
			try {
				nomsDesSecrets(texte);
			} catch (erreur) {
				expect(String(erreur)).not.toContain('valeur-secrete');
			}
		}
	});
});

describe('controleDeVie', () => {
	const sansAttente = async () => {};

	it('réussit dès que /connexion répond 200', async () => {
		const demandes: string[] = [];
		const reponses = [503, 200];
		const ok = await controleDeVie('https://appli.exemple', {
			demander: async (url) => (demandes.push(url), reponses.shift()!),
			attendre: sansAttente
		});
		expect(ok).toBe(true);
		expect(demandes).toEqual(['https://appli.exemple/connexion', 'https://appli.exemple/connexion']);
	});

	it('échoue après plusieurs essais sans 200, y compris sur une redirection', async () => {
		let essais = 0;
		const ok = await controleDeVie('https://appli.exemple', { demander: async () => (essais++, 302), attendre: sansAttente });
		expect(ok).toBe(false);
		expect(essais).toBe(6);
	});

	it('compte une erreur réseau comme un essai raté', async () => {
		const ok = await controleDeVie('https://appli.exemple', {
			demander: async () => {
				throw new Error('réseau');
			},
			attendre: sansAttente
		});
		expect(ok).toBe(false);
	});
});

describe('controler', () => {
	const repond = (statut: number) => ({ demander: async () => statut, attendre: async () => {} });

	it('réussit quand tout est là et que /connexion répond', async () => {
		const { ok, messages } = await controler('exemple', tous, adresse, repond(200));
		expect(ok).toBe(true);
		expect(messages.at(-1)).toBe('https://appli.exemple/connexion répond 200.');
	});

	it('échoue sur un réglage manquant, sans même appeler l’appli, en ne nommant que les réglages', async () => {
		let appels = 0;
		const { ok, messages } = await controler('exemple', ['BETTER_AUTH_SECRET'], adresse, { demander: async () => (appels++, 200), attendre: async () => {} });
		expect(ok).toBe(false);
		expect(appels).toBe(0);
		expect(messages).toEqual(['::error::Réglages manquants sur le Worker gyro-caserne-exemple : SUPER_ADMINS, BREVO_CLE. Voir docs/technique/installer-un-centre.md.']);
	});

	it('échoue si /connexion ne répond pas 200', async () => {
		const { ok, messages } = await controler('exemple', tous, adresse, repond(500));
		expect(ok).toBe(false);
		expect(messages.at(-1)).toContain('ne répond pas 200');
	});

	it('avertit sans échouer quand l’adresse n’est qu’en secret', async () => {
		const { ok, messages } = await controler('exemple', [...tous, 'BETTER_AUTH_URL'], {}, repond(500));
		expect(ok).toBe(true);
		expect(messages.at(-1)).toMatch(/^::warning::/);
	});
});

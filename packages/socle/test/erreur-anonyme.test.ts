import { describe, expect, it } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { resumeErreur, sansDonnees } from '../src/erreur-anonyme.ts';

// Le journal de Cloudflare garde ce que l'appli écrit : aucune adresse, aucun lien, aucun jeton, aucune valeur de la base.
describe('sansDonnees', () => {
	it('masque les adresses e-mail', () => {
		expect(sansDonnees('Refus pour alice.martin@exemple.fr et Bob@Exemple.FR')).toBe('Refus pour [adresse] et [adresse]');
	});

	it('ne garde d’une adresse web que son chemin, sans paramètres', () => {
		expect(sansDonnees('voir https://gyro.exemple.fr/api/auth/magic-link/verify?token=abc&callbackURL=%2F fin')).toBe('voir https://gyro.exemple.fr/api/auth/magic-link/verify?[…] fin');
	});

	it('masque les longues suites de lettres et chiffres (jetons, clés)', () => {
		expect(sansDonnees('clé xkeysib-0123456789abcdef0123 et agenda/Zx9kQ2mP7vR4tL8wB1nC.ics')).toBe('clé [jeton] et agenda/[jeton].ics');
	});

	it('masque aussi une adresse accentuée ou encodée, et les paramètres d’un chemin sans domaine', () => {
		expect(sansDonnees('pour andré.dupont@exemple.fr')).toBe('pour [adresse]');
		expect(sansDonnees('/echanges/messages/a/alice%40exemple.fr')).toBe('/echanges/messages/a/[adresse]');
		expect(sansDonnees('vers /api/auth/magic-link/verify?token=court&x=1')).toBe('vers /api/auth/magic-link/verify?[…]');
	});

	it('garde les noms de colonnes, même longs', () => {
		expect(sansDonnees('select "attribution_perimetre_type", "access_token_expires_at"')).toBe('select "attribution_perimetre_type", "access_token_expires_at"');
	});

	it('garde un texte ordinaire', () => {
		expect(sansDonnees('D1_ERROR: UNIQUE constraint failed: personne.email')).toBe('D1_ERROR: UNIQUE constraint failed: personne.email');
	});
});

describe('resumeErreur', () => {
	it('ne garde pas les valeurs d’une requête refusée, seulement la requête et la cause', () => {
		const cause = new Error('D1_ERROR: UNIQUE constraint failed: personne.email');
		const erreur = new DrizzleQueryError('insert into "personne" ("nom", "email") values (?, ?)', ['Martin', 'alice.martin@exemple.fr'], cause);
		const resume = resumeErreur(erreur);
		expect(resume).toContain('insert into "personne"');
		expect(resume).toContain('UNIQUE constraint failed');
		expect(resume).not.toContain('Martin');
		expect(resume).not.toContain('alice.martin');
		expect(resume).not.toContain('params');
	});

	it('donne le nom et le message nettoyé d’une erreur', () => {
		expect(resumeErreur(new TypeError('Courriel refusé pour a@exemple.fr'))).toMatch(/^TypeError: Courriel refusé pour \[adresse\]/);
	});

	it('garde les lignes de pile, qui ne disent que le code en cause', () => {
		const erreur = new Error('Panne pour a@exemple.fr');
		erreur.stack = 'Error: Panne pour a@exemple.fr\n    at envoyer (courriel.ts:12:3)\n    at auth.ts:40:1';
		const resume = resumeErreur(erreur);
		expect(resume).toContain('at envoyer (courriel.ts:12:3)');
		expect(resume).not.toContain('a@exemple.fr');
	});

	it('ne recopie pas une fausse ligne de pile glissée dans le message', () => {
		const resume = resumeErreur(new Error('Panne\n    at faux a@exemple.fr'));
		expect(resume).not.toContain('a@exemple.fr');
	});

	it('ne recopie pas un objet qui n’est pas une erreur', () => {
		expect(resumeErreur({ email: 'a@exemple.fr' })).toBe('object');
		expect(resumeErreur('a@exemple.fr')).toBe('string');
	});

	it('reste court', () => {
		expect(resumeErreur(new Error('x'.repeat(5000))).length).toBeLessThanOrEqual(1000);
	});
});

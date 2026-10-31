import { describe, expect, it } from 'vitest';
import { emailCherche } from './liste-agents.ts';

describe('emailCherche', () => {
	const alice = { prenom: 'Alice', nom: 'Martin', email: 'a.martin@exemple.fr' };
	it('vrai quand seul l’e-mail répond, sans tenir compte des majuscules ni des espaces', () => {
		expect(emailCherche(alice, ' A.MARTIN@ ')).toBe(true);
		expect(emailCherche(alice, 'exemple')).toBe(true);
	});
	it('faux quand le nom ou le prénom répond, ou sans recherche', () => {
		expect(emailCherche(alice, 'martin')).toBe(false);
		expect(emailCherche(alice, 'ali')).toBe(false);
		expect(emailCherche(alice, '')).toBe(false);
		expect(emailCherche({ prenom: 'Alice', nom: 'Martin' }, 'exemple')).toBe(false);
	});
});

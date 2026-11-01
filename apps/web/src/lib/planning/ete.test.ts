import { describe, expect, it } from 'vitest';
import { libellePlage, texteArme } from './ete.ts';

describe('tableau de l’été', () => {
	it('le nom court d’une plage', () => {
		expect(libellePlage({ debut: '2027-06-25T18:00', fin: '2027-06-26T06:00' })).toBe('Ven. 25 juin · nuit');
		expect(libellePlage({ debut: '2027-06-26T06:00', fin: '2027-06-27T06:00' })).toBe('Sam. 26 juin · 24 h');
	});

	it('FPT armé, en texte', () => {
		expect(texteArme(true, [])).toBe('FPT armé : oui');
		expect(texteArme(false, ['ca2', 'agent', 'agent'])).toBe('FPT armé : non, manque CA tout engins, 2 agents');
	});
});

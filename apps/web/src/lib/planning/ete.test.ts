import { describe, expect, it } from 'vitest';
import { etapeEteDe, libellePlage, phrasePeriode, resumeEte, texteArme, texteEngin, texteIlManque } from './ete.ts';

describe('tableau de l’été', () => {
	it('le nom court d’une plage', () => {
		expect(libellePlage({ debut: '2027-06-25T18:00', fin: '2027-06-26T06:00' })).toBe('Ven. 25 juin · nuit');
		expect(libellePlage({ debut: '2027-06-26T06:00', fin: '2027-06-27T06:00' })).toBe('Sam. 26 juin · 24 h');
	});

	it('FPT armé, en texte ; ce qui manque, compté', () => {
		expect(texteArme(true, [])).toBe('FPT armé : oui');
		expect(texteArme(false, ['ca2', 'agent', 'agent'])).toBe('FPT armé : non, manque CA tout engins, 2 agents');
		expect(texteIlManque(['ce'])).toBe('Il manque : 1 CE');
		expect(texteIlManque(['ca2', 'agent', 'agent'])).toBe('Il manque : 1 CA tout engins, 2 agents');
	});

	it('la période en une phrase', () => {
		expect(phrasePeriode('2027-06-25', '2027-09-03', '2027-05-15')).toBe('Du ven. 25 juin au jeu. 2 sept. · vacances avant le 15 mai');
	});

	it('le résumé en tête, chiffres réels', () => {
		const plages = (n: number, armees: number) => Array.from({ length: n }, (_, i) => ({ arme: i < armees }));
		const reponses = [
			{ reponse: 'vacances', periodes: [{}] },
			{ reponse: 'vacances', periodes: [] },
			{ reponse: 'tout', periodes: [] },
			{ reponse: null, periodes: [] }
		];
		const e = { ete: { publiee: false }, proposee: true, semaines: [{ plages: plages(7, 7) }, { plages: plages(7, 7) }], reponses };
		expect(resumeEte(e)).toBe('Proposé · 2 semaines · FPT armé partout · 1 agent en vacances · 1 sans réponse');
		expect(resumeEte({ ...e, semaines: [{ plages: plages(7, 5) }] })).toBe('Proposé · 1 semaine · FPT non armé sur 2 plages · 1 agent en vacances · 1 sans réponse');
		expect(resumeEte({ ...e, ete: { publiee: true } })).toMatch(/^Publié · /);
		expect(resumeEte({ ete: { publiee: false }, proposee: false, semaines: [{ plages: [] }], reponses: [] })).toBe('Vacances en cours · 1 semaine · 0 agent en vacances · 0 sans réponse');
		expect(resumeEte({ ete: null, proposee: false, semaines: [], reponses: [] })).toBe('Pas encore ouvert');
	});

	it('l’étape ouverte : demandée, sinon celle où en est l’été', () => {
		const url = (q = '') => new URL(`http://x/planning/ete${q}`);
		expect(etapeEteDe(url('?etape=publier'), { ete: null, proposee: false })).toBe('publier');
		expect(etapeEteDe(url(), { ete: null, proposee: false })).toBe('periode');
		expect(etapeEteDe(url(), { ete: {}, proposee: false })).toBe('vacances');
		expect(etapeEteDe(url('?etape=autre'), { ete: {}, proposee: true })).toBe('repartition');
	});

	it('un engin en une ligne : postes à zéro masqués', () => {
		expect(texteEngin({ ca2: 0, ca1: 1, ce: 1, cod1: 0, agent: 1 })).toBe('3 postes : CA 1 agrès, CE, agent');
		expect(texteEngin({ ca2: 1, ca1: 0, ce: 2, cod1: 1, agent: 2 })).toBe('6 postes : CA tout engins, conducteur, 2 CE, 2 agents');
	});
});

import { describe, expect, it } from 'vitest';
import { periodesDeLaSemaine, feries } from '@gyro-caserne/socle';
import centre from '$centre';
import { phraseAstreinte, priseDeGardeOuverte } from './astreinte.ts';

const f = new Set(feries(2026).map((x) => x.date));
const semaine = (debut: string) => {
	const periodes = periodesDeLaSemaine(debut, centre.astreinte, f);
	return { debut: periodes[0]!.debut, fin: periodes.at(-1)!.fin, periodes };
};
const equipe = { id: 3, nom: 'Équipe 3', couleur: '#1565c0' };
const a = (debut: string, autres = {}) => ({ ...semaine(debut), equipe, enCours: false, mienne: true, ...autres });

describe('phrase de la carte astreinte', () => {
	it('à venir : le compte à rebours et les dates courtes', () => {
		const p = phraseAstreinte(a('2026-11-20'), '2026-11-01T10:00');
		expect(p).toMatchObject({ titre: 'Votre équipe est d’astreinte dans 19 jours', quand: 'du ven. 20 nov. 18 h au ven. 27 nov. 6 h', jours: 19, plage: null });
	});

	it('demain, ce soir', () => {
		expect(phraseAstreinte(a('2026-11-20'), '2026-11-19T10:00').titre).toBe('Votre équipe est d’astreinte demain à 18 h');
		expect(phraseAstreinte(a('2026-11-20'), '2026-11-20T10:00').titre).toBe('Vous êtes d’astreinte ce soir à 18 h');
	});

	it('en cours, hors plage : jusqu’à la fin et la prochaine plage', () => {
		const p = phraseAstreinte(a('2026-11-20', { enCours: true }), '2026-11-24T14:00');
		expect(p.titre).toBe('Vous êtes d’astreinte jusqu’à vendredi 6 h');
		expect(p.plage).toBe('Prochaine plage : ce soir 18 h – 6 h');
	});

	it('en cours, dans une plage : jusqu’à quand', () => {
		expect(phraseAstreinte(a('2026-11-20', { enCours: true }), '2026-11-24T22:00').plage).toBe('En ce moment, jusqu’à demain 6 h');
		expect(phraseAstreinte(a('2026-11-20', { enCours: true }), '2026-11-21T10:00').plage).toBe('En ce moment, jusqu’à lundi 6 h');
	});

	it('sans équipe : l’équipe de la semaine', () => {
		expect(phraseAstreinte(a('2026-11-20', { enCours: true, mienne: false }), '2026-11-24T14:00').titre).toBe('Cette semaine : Équipe 3 d’astreinte');
	});
});

describe('lien vers la prise de garde', () => {
	const debut = '2026-11-06T18:00';
	it.each([
		['la veille', '2026-11-05T18:00', false],
		['2 h 01 avant', '2026-11-06T15:59', false],
		['2 h avant pile', '2026-11-06T16:00', true],
		['à la relève', debut, true],
		['24 h après pile', '2026-11-07T18:00', true],
		['24 h 01 après', '2026-11-07T18:01', false],
		['le reste de la semaine', '2026-11-10T09:00', false]
	])('%s', (_cas, maintenant, attendu) => {
		expect(priseDeGardeOuverte(debut, maintenant)).toBe(attendu);
	});
	it('les secondes de l’heure de Paris ne comptent pas', () => {
		expect(priseDeGardeOuverte(debut, '2026-11-07T18:00:59')).toBe(true);
	});
	it('passe le changement de mois et d’année', () => {
		expect(priseDeGardeOuverte('2027-01-01T18:00', '2027-01-01T16:00')).toBe(true);
		expect(priseDeGardeOuverte('2026-12-31T23:00', '2027-01-01T22:00')).toBe(true);
	});
	it('le jour du passage à l’heure d’été : l’heure lue à Paris, sans décalage', () => {
		expect(priseDeGardeOuverte('2027-03-27T18:00', '2027-03-28T18:00')).toBe(true);
		expect(priseDeGardeOuverte('2027-03-27T18:00', '2027-03-28T18:01')).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { calculerAnnee } from '@gyro-caserne/socle';
import { etatEquipe, resumeProposition, texteCompromis, deplacer, echangePropose, etapeDe, recapitulatif } from './preparer.ts';

const semaines = calculerAnnee(2027, centre.astreinte, [1, 2, 3, 4], new Map());

describe('préparer l’année', () => {
	it('l’étape vient de l’adresse, Roulement par défaut', () => {
		expect(etapeDe(new URL('http://x/?etape=fetes'))).toBe('fetes');
		expect(etapeDe(new URL('http://x/?etape=nimporte'))).toBe('roulement');
		expect(etapeDe(new URL('http://x/'))).toBe('roulement');
	});

	it('monter et descendre une équipe ; rien ne bouge aux bords', () => {
		expect(deplacer([1, 2, 3, 4], 1, -1)).toEqual([2, 1, 3, 4]);
		expect(deplacer([1, 2, 3, 4], 1, 1)).toEqual([1, 3, 2, 4]);
		expect(deplacer([1, 2, 3, 4], 0, -1)).toEqual([1, 2, 3, 4]);
		expect(deplacer([1, 2, 3, 4], 3, 1)).toEqual([1, 2, 3, 4]);
		expect(deplacer([1, 2, 3, 4], 9, 1)).toEqual([1, 2, 3, 4]);
	});

	it('propose d’échanger la semaine de Noël avec la plus proche d’une équipe dont c’est le tour', () => {
		const noel = semaines.find((s) => s.debut === '2027-12-24')!;
		expect(noel.equipeId).toBe(4);
		const e = echangePropose(semaines, 'noel', [2], 2027)!;
		expect(e.fete.debut).toBe('2027-12-24');
		// Équipe 2 : la semaine du 10 décembre, deux avant Noël.
		expect(e.autre).toMatchObject({ debut: '2027-12-10', equipeId: 2 });
		expect(echangePropose(semaines, 'noel', [4], 2027)).toBeNull();
		expect(echangePropose(semaines, 'noel', [], 2027)).toBeNull();
	});

	it('récapitule l’année', () => {
		const r = recapitulatif({ semaines, manoeuvres: [{ annulee: false }, { annulee: true }], vacances: [{}], fetes: { noel: 4, nouvelAn: 1 }, equipes: [1, 2, 3, 4].map((id) => ({ id, nom: `Équipe ${id}`, couleur: '#000' })) });
		expect(r).toEqual(['53 semaines, aucune changée', '1 manœuvre', 'Noël : Équipe 4 · Nouvel An : Équipe 1', '1 période de vacances']);
	});

	const proposition = (autres: Record<string, unknown> = {}) => ({
		semaines: 52,
		fetes: { noel: { equipeId: 2, dansLeTour: true, attendues: [2] }, nouvelAn: { equipeId: 4, dansLeTour: true, attendues: [4] }, compromis: false, memeSemaine: false, deSuite: [] },
		manoeuvres: Array.from({ length: 11 }, () => ({})),
		vacances: 2,
		equipes: [{ id: 1, nom: 'Équipe 1', effectif: 6, arme: true, manque: [] }, { id: 3, nom: 'Équipe 3', effectif: 6, arme: false, manque: ['ce'] }],
		...autres
	});
	const equipes = [1, 2, 3, 4].map((id) => ({ id, nom: `Équipe ${id}`, couleur: '#000' }));

	it('le résumé de la proposition, en une ligne', () => {
		expect(resumeProposition(proposition() as never, equipes)).toBe('52 semaines, Noël : Équipe 2, Nouvel An : Équipe 4, 11 manœuvres reprises, Équipe 3 incomplète');
	});

	it('le résumé rappelle les vacances à saisir ; aucune manœuvre, toutes les équipes armées', () => {
		const r = resumeProposition(proposition({ vacances: 0, manoeuvres: [], equipes: [] }) as never, equipes);
		expect(r).toBe('52 semaines, Noël : Équipe 2, Nouvel An : Équipe 4, Aucune manœuvre reprise, Aucune période de vacances saisie');
	});

	it('l’état d’une équipe, en toutes lettres', () => {
		expect(etatEquipe({ nom: 'Équipe 3', effectif: 6, arme: false, manque: ['ce'] })).toBe('Équipe 3 : 6 agents, il manque 1 CE');
		expect(etatEquipe({ nom: 'Équipe 1', effectif: 1, arme: false, manque: ['ca2', 'agent', 'agent'] })).toBe('Équipe 1 : 1 agent, il manque 1 CA tout engins, 2 agents');
		expect(etatEquipe({ nom: 'Équipe 2', effectif: 7, arme: true, manque: [] })).toBe('Équipe 2 : 7 agents, peut armer le FPT seule');
	});

	it('le compromis est dit clairement ; aucun sans compromis', () => {
		const fetes = (noel: object, nouvelAn: object, memeSemaine = false) => ({ noel: { dansLeTour: true, ...noel }, nouvelAn: { dansLeTour: true, ...nouvelAn }, compromis: true, memeSemaine, deSuite: [] });
		expect(texteCompromis(proposition().fetes as never, equipes)).toBeNull();
		expect(texteCompromis(fetes({ equipeId: 2, attendues: [2] }, { equipeId: 1, dansLeTour: false, attendues: [2] }) as never, equipes)).toBe('Impossible de respecter le tour des deux fêtes : c’est à Équipe 2 de tenir Noël et le Nouvel An, et une équipe ne tient pas les deux. Compromis : Noël pour Équipe 2, Nouvel An pour Équipe 1.');
		expect(texteCompromis(fetes({ equipeId: 1, attendues: [1] }, { equipeId: 1, dansLeTour: false, attendues: [2] }, true) as never, equipes)).toBe('Impossible de respecter le tour des deux fêtes : elles tombent dans la même semaine, et c’est à Équipe 1 de tenir Noël, à Équipe 2 de tenir le Nouvel An. Compromis : Équipe 1 tient les deux.');
	});
});

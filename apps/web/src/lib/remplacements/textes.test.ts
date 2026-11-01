import { describe, expect, it } from 'vitest';
import type { VueDemande } from '@gyro-caserne/socle';
import { frise, majuscule } from './textes.ts';

const bruno = { id: 2, prenom: 'Bruno', nom: 'Test' };
const v = (o: Partial<VueDemande>) => ({ genre: 'remplacement', etat: 'attente', cible: null, remplacant: null, manque: [], ...o }) as VueDemande;
const lire = (d: VueDemande) => frise(d).map((p) => `${p.libelle} (${p.etat})`);

describe('textes des remplacements', () => {
	it('majuscule', () => expect(majuscule('nuit du lundi')).toBe('Nuit du lundi'));

	it('frise : en attente, acceptée, validée par le chef si besoin, conclue', () => {
		expect(lire(v({}))).toEqual(['Envoyée (fait)', 'En attente d’un collègue (en-cours)', 'Conclue (a-venir)']);
		expect(lire(v({ cible: bruno }))).toEqual(['Envoyée (fait)', 'En attente de Bruno Test (en-cours)', 'Conclue (a-venir)']);
		expect(lire(v({ etat: 'a_valider', remplacant: bruno, manque: ['CA1'] }))).toEqual(['Envoyée (fait)', 'Acceptée par Bruno Test (fait)', 'À valider par le chef (en-cours)', 'Conclue (a-venir)']);
		expect(lire(v({ etat: 'conclue', remplacant: bruno, manque: ['CA1'] }))).toEqual(['Envoyée (fait)', 'Acceptée par Bruno Test (fait)', 'Validée par le chef (fait)', 'Conclue (fait)']);
		expect(lire(v({ etat: 'conclue', remplacant: bruno }))).toEqual(['Envoyée (fait)', 'Acceptée par Bruno Test (fait)', 'Conclue (fait)']);
	});

	it('frise : refusée, annulée, expirée s’arrêtent là', () => {
		expect(lire(v({ etat: 'refusee', cible: bruno }))).toEqual(['Envoyée (fait)', 'Refusée par Bruno Test (arret)']);
		expect(lire(v({ etat: 'annulee' }))).toEqual(['Envoyée (fait)', 'Annulée (arret)']);
		expect(lire(v({ etat: 'expiree', genre: 'echange', cible: bruno }))).toEqual(['Proposée (fait)', 'Expirée (arret)']);
	});
});

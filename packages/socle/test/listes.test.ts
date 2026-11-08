import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { checkDans, DROITS, DROITS_DU_CENTRE, estDroitDuCentre, STATUTS_AVEC_ACCES, STATUTS_OPERATIONNELS } from '../src/listes.ts';

describe('listes fermées', () => {
	it('contient tous les droits de l’inventaire', () => {
		expect(DROITS).toEqual([
			'VOIR_PLANNING',
			'VOIR_ANNUAIRE',
			'VOIR_ENGINS',
			'VOIR_ANOMALIES',
			'SIGNALER_ANOMALIE',
			'SIGNALER_BESOIN_STOCK',
			'DEMANDER_REMPLACEMENT',
			'DECLARER_DISPONIBILITE',
			'UTILISER_MESSAGERIE',
			'FAIRE_PRISE_DE_GARDE',
			'PRENDRE_EN_CHARGE_ANOMALIE',
			'TRAITER_ANOMALIE',
			'GERER_FICHES',
			'GERER_STOCK',
			'GERER_HABILLEMENT',
			'GERER_PLANNING',
			'VALIDER_REMPLACEMENT',
			'VOIR_MOTIFS_ABSENCE',
			'LIRE_SALON',
			'PUBLIER_SALON',
			'MODERER_SALON',
			'EPINGLER_SALON',
			'RESERVER',
			'GERER_RESERVATIONS',
			'MODERER_MESSAGERIE',
			'GERER_LISTES',
			'GERER_ACCES',
			'GERER_COMITES',
			'ATTRIBUER_RESPONSABILITE',
		]);
	});

	it('les statuts avec accès font partie des statuts', () => {
		for (const statut of STATUTS_AVEC_ACCES) expect(STATUTS_OPERATIONNELS).toContain(statut);
	});

	it('checkDans produit une contrainte CHECK ... IN sans paramètre', () => {
		const { sql, params } = new SQLiteSyncDialect().sqlToQuery(checkDans('statut', ['a', 'b']));
		expect(sql).toBe(`"statut" IN ('a', 'b')`);
		expect(params).toEqual([]);
	});
});

describe('estDroitDuCentre', () => {
	it('les trois droits qui valent pour tout le centre, pas « Nommer »', () => {
		expect(DROITS.filter(estDroitDuCentre).sort()).toEqual([...DROITS_DU_CENTRE].sort());
		expect(estDroitDuCentre('ATTRIBUER_RESPONSABILITE')).toBe(false);
	});
});

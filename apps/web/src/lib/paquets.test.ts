import { describe, expect, it } from 'vitest';
import { DROITS, DROITS_SANS_EFFET, MODELES, type Droit } from '@gyro-caserne/socle';
import { ADMINISTRATION, appliquerNiveaux, DOMAINES, estPersonnalise, niveauxDe } from './paquets.ts';

const CHEF_CENTRE: Droit[] = ['GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'GERER_PLANNING', 'ATTRIBUER_RESPONSABILITE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'GERER_HABILLEMENT', 'MODERER_MESSAGERIE'];
const AGENT: Droit[] = ['VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_ENGINS', 'VOIR_ANOMALIES', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'DEMANDER_REMPLACEMENT', 'DECLARER_DISPONIBILITE', 'UTILISER_MESSAGERIE', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE'];
const RIEN = { planning: 0, engins: 0, stock: 0, habillement: 0, reservations: 0, messagerie: 0 };

describe('DOMAINES', () => {
	it('reprend le tableau de la spec, niveaux cumulatifs', () => {
		const vue = DOMAINES.map((d) => [d.id, d.nom, d.niveaux.map((n) => [n.libelle, n.droits])]);
		expect(vue).toEqual([
			[
				'planning',
				'Planning et gardes',
				[
					['Rien de plus', []],
					['Valider les remplacements', ['VALIDER_REMPLACEMENT']],
					['Gérer le planning', ['VALIDER_REMPLACEMENT', 'GERER_PLANNING']]
				]
			],
			['engins', 'Engins et anomalies', [['Rien de plus', []], ['Gérer', ['TRAITER_ANOMALIE', 'GERER_FICHES']]]],
			['stock', 'Stock et pharmacie', [['Rien de plus', []], ['Gérer', ['GERER_STOCK']]]],
			['habillement', 'Habillement', [['Rien de plus', []], ['Gérer', ['GERER_HABILLEMENT']]]],
			['reservations', 'Réservations', [['Rien', []], ['Réserver', ['RESERVER']], ['Gérer', ['RESERVER', 'GERER_RESERVATIONS']]]],
			['messagerie', 'Messagerie', [['Rien de plus', []], ['Modérer', ['MODERER_MESSAGERIE']]]]
		]);
		for (const d of DOMAINES) for (const n of d.niveaux) expect(n.phrase.trim()).not.toBe('');
	});

	it('met à part les quatre droits de pouvoir, et aucun salon dans les paquets', () => {
		expect(ADMINISTRATION.map((a) => a.droit)).toEqual(['GERER_ACCES', 'GERER_COMITES', 'GERER_LISTES', 'ATTRIBUER_RESPONSABILITE']);
		const tous = DOMAINES.flatMap((d) => d.niveaux.flatMap((n) => n.droits));
		expect(tous.some((d) => d.includes('SALON'))).toBe(false);
		expect(tous.every((d) => (DROITS as readonly string[]).includes(d))).toBe(true);
	});
});

describe('droits sans effet', () => {
	it('VOIR_MOTIFS_ABSENCE et VOIR_ANNUAIRE : ni dans les paquets, ni dans les cases, ni comptés pour « Personnalisé »', () => {
		expect(DROITS_SANS_EFFET).toEqual(['VOIR_MOTIFS_ABSENCE', 'VOIR_ANNUAIRE']);
		const montres = [...DOMAINES.flatMap((d) => d.niveaux.flatMap((n) => n.droits)), ...ADMINISTRATION.map((a) => a.droit)];
		for (const d of DROITS_SANS_EFFET) expect(montres).not.toContain(d);
		// Une ligne ancienne ne change ni le niveau lu ni la comparaison au modèle.
		expect(niveauxDe(['VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE']).planning).toBe(1);
		expect(estPersonnalise(['GERER_STOCK', 'VOIR_MOTIFS_ABSENCE', 'VOIR_ANNUAIRE'], 'referent_pharmacie')).toBe(false);
		expect([...appliquerNiveaux(['VOIR_MOTIFS_ABSENCE'], { planning: 0 })]).toEqual(['VOIR_MOTIFS_ABSENCE']);
	});
});

describe('niveauxDe', () => {
	it('lit chaque rôle du jeu de départ', () => {
		expect(niveauxDe(['VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE'])).toEqual({ ...RIEN, planning: 1 });
		expect(niveauxDe(['TRAITER_ANOMALIE', 'GERER_FICHES'])).toEqual({ ...RIEN, engins: 1 });
		expect(niveauxDe(['GERER_STOCK'])).toEqual({ ...RIEN, stock: 1 });
		expect(niveauxDe(['GERER_HABILLEMENT'])).toEqual({ ...RIEN, habillement: 1 });
		expect(niveauxDe(['GERER_LISTES', 'GERER_COMITES'])).toEqual(RIEN);
		expect(niveauxDe(['ATTRIBUER_RESPONSABILITE'])).toEqual(RIEN);
		expect(niveauxDe([])).toEqual(RIEN);
		expect(niveauxDe(CHEF_CENTRE)).toEqual({ planning: 'sur_mesure', engins: 1, stock: 1, habillement: 1, reservations: 0, messagerie: 1 });
		expect(niveauxDe(AGENT)).toEqual(RIEN);
	});

	it('« Sur mesure » quand les droits du domaine ne tombent sur aucun niveau', () => {
		expect(niveauxDe(['TRAITER_ANOMALIE']).engins).toBe('sur_mesure');
		expect(niveauxDe(['GERER_RESERVATIONS']).reservations).toBe('sur_mesure');
		expect(niveauxDe(['RESERVER', 'GERER_RESERVATIONS']).reservations).toBe(2);
	});
});

describe('appliquerNiveaux', () => {
	it('remplace seulement les domaines choisis, garde le reste (salons, pouvoir, droits de base)', () => {
		const avant: Droit[] = ['GERER_PLANNING', 'TRAITER_ANOMALIE', 'LIRE_SALON', 'PUBLIER_SALON', 'GERER_ACCES', 'VOIR_PLANNING'];
		const apres = appliquerNiveaux(avant, { stock: 1, messagerie: 1 });
		expect([...apres].sort()).toEqual([...avant, 'GERER_STOCK', 'MODERER_MESSAGERIE'].sort());
	});

	it('met le domaine au niveau choisi', () => {
		expect([...appliquerNiveaux(['GERER_PLANNING', 'LIRE_SALON'], { planning: 1 })].sort()).toEqual(['LIRE_SALON', 'VALIDER_REMPLACEMENT']);
		expect(appliquerNiveaux(['TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK'], { engins: 0 })).toEqual(['GERER_STOCK']);
	});

	it('sans choix, rien ne change (un domaine « Sur mesure » reste tel quel)', () => {
		expect(appliquerNiveaux(CHEF_CENTRE, {})).toEqual(CHEF_CENTRE);
	});
});

describe('estPersonnalise', () => {
	it('compare aux droits du modèle, sans tenir compte de l’ordre', () => {
		const materiel = MODELES.find((m) => m.id === 'referent_materiel')!;
		expect(estPersonnalise(['GERER_FICHES', 'TRAITER_ANOMALIE'], materiel.id)).toBe(false);
		expect(estPersonnalise(['GERER_FICHES', 'TRAITER_ANOMALIE', 'GERER_STOCK'], materiel.id)).toBe(true);
		expect(estPersonnalise(['TRAITER_ANOMALIE'], materiel.id)).toBe(true);
	});

	it('sans modèle (ou modèle inconnu), jamais personnalisé', () => {
		expect(estPersonnalise(['GERER_STOCK'], null)).toBe(false);
		expect(estPersonnalise(['GERER_STOCK'], 'disparu')).toBe(false);
	});
});

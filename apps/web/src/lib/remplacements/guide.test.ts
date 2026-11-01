import { describe, expect, it } from 'vitest';
import { etapes, lirePeriodes, phrasePeriodes, plage, raccourcis } from './guide.ts';

const t = (debut: string, fin: string, etat: 'libre' | 'prise' | 'passee' | 'occupe' = 'libre') => ({ debut, fin, etat });
// Semaine du vendredi 6 novembre 2026 : nuit du vendredi, 24 h samedi et dimanche, puis les nuits.
const semaine = [
	t('2026-11-06T18:00', '2026-11-07T06:00', 'passee'),
	t('2026-11-07T06:00', '2026-11-08T06:00'),
	t('2026-11-08T06:00', '2026-11-09T06:00'),
	t('2026-11-09T18:00', '2026-11-10T06:00', 'prise'),
	t('2026-11-10T18:00', '2026-11-11T06:00'),
	t('2026-11-11T18:00', '2026-11-12T06:00'),
	t('2026-11-12T18:00', '2026-11-13T06:00')
];

describe('parcours guidé', () => {
	it('la plage dite en heures', () => {
		expect(plage(semaine[0]!)).toBe('18 h – 6 h');
		expect(plage(semaine[1]!)).toBe('24 h');
	});

	it('raccourcis : ce soir si une nuit libre commence aujourd’hui, le week-end, toute la semaine ; jamais une période inactive', () => {
		const r = raccourcis(semaine, '2026-11-10T09:00');
		expect(r.map((x) => [x.libelle, x.periodes.length])).toEqual([
			['Ce soir', 1],
			['Le week-end', 2],
			['Toute la semaine', 5]
		]);
		expect(raccourcis(semaine, '2026-11-09T09:00').map((x) => x.libelle)).toEqual(['Le week-end', 'Toute la semaine']);
		// Une seule période libre : pas de raccourci qui la répète.
		expect(raccourcis([t('2026-11-12T18:00', '2026-11-13T06:00')], '2026-11-01T09:00').map((x) => x.libelle)).toEqual([]);
	});

	it('la phrase : les nuits avec leurs heures, les gardes de 24 h, les périodes qui se suivent réunies', () => {
		expect(phrasePeriodes([{ debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' }])).toBe('la nuit du lundi 9 novembre (18 h – 6 h)');
		expect(phrasePeriodes([{ debut: '2026-11-07T06:00', fin: '2026-11-08T06:00' }])).toBe('la garde de 24 h du samedi 7 novembre');
		expect(phrasePeriodes([semaine[1]!, semaine[2]!, semaine[5]!])).toBe('du samedi 7 novembre, 6 h au lundi 9 novembre, 6 h et la nuit du mercredi 11 novembre (18 h – 6 h)');
	});

	it('lit les périodes de l’adresse, ignore le reste', () => {
		expect(lirePeriodes(['2026-11-09T18:00|2026-11-10T06:00', 'n’importe quoi', '2026-11-09T18:00|2026-11-10T06:00'])).toEqual([{ debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' }]);
	});

	it('les étapes : trois pour un remplacement, quatre pour un échange', () => {
		expect(etapes('remplacement').map((e) => e.titre)).toEqual(['Quand ?', 'À qui ?', 'Vérifier et envoyer']);
		expect(etapes('echange').map((e) => e.titre)).toEqual(['Ma période', 'Le collègue', 'Sa période', 'Vérifier et envoyer']);
	});
});

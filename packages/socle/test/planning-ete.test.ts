import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { ajouterMesVacances, mesVacances, periodeParDefaut, rappelsEte, reglerEte, reponsesEte, retirerMesVacances, toutLete } from '../src/planning/ete.ts';
import { filDeNotifications } from '../src/notifications.ts';
import { avisEte, ete } from '../src/schema.ts';
import { jeuEte } from './jeu-ete.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2027-03-01T10:00';

describe('été : période et date limite', () => {
	it('par défaut, de la dernière relève de juin à la dernière d’août', () => {
		expect(periodeParDefaut(2027, reglage)).toEqual({ debut: '2027-06-25', fin: '2027-08-27', dateLimite: '2027-05-15' });
	});

	it('réglée par qui gère le planning ; des jours de relève de l’année', async () => {
		const { base, chef, nouvelle, a } = await jeuEte();
		const alice = a(await nouvelle('Alice', 1));
		await expect(reglerEte(base, alice, 2027, periodeParDefaut(2027, reglage), maintenant, reglage)).rejects.toThrow(RefusDroit);
		await expect(reglerEte(base, chef, 2027, { ...periodeParDefaut(2027, reglage), debut: '2027-06-24' }, maintenant, reglage)).rejects.toThrow('Jour de relève');
		await expect(reglerEte(base, chef, 2027, { debut: '2027-08-27', fin: '2027-06-25', dateLimite: '2027-05-15' }, maintenant, reglage)).rejects.toThrow(DonneeInvalide);
		await reglerEte(base, chef, 2027, periodeParDefaut(2027, reglage), maintenant, reglage);
		expect(await base.select().from(ete)).toEqual([{ annee: 2027, debut: '2027-06-25', fin: '2027-08-27', dateLimite: '2027-05-15', publieeLe: null, rappelMoisLe: null, rappelSemaineLe: null }]);
	});
});

describe('Mes vacances', () => {
	it('été pas encore ouvert : rien à saisir', async () => {
		const { base, nouvelle, a } = await jeuEte();
		const alice = a(await nouvelle('Alice', 1));
		expect(await mesVacances(base, alice, maintenant)).toEqual({ ete: null, reponse: null, periodes: [] });
		await expect(ajouterMesVacances(base, alice, 2027, { debut: '2027-07-10', fin: '2027-07-20' }, maintenant)).rejects.toThrow('Été pas encore ouvert');
	});

	it('des périodes, ou « disponible tout l’été » ; le chef voit qui a répondu', async () => {
		const { base, chef, nouvelle, a } = await jeuEte();
		const alice = a(await nouvelle('Alice', 1));
		const bruno = a(await nouvelle('Bruno', 2));
		const david = a(await nouvelle('David', 1));
		await nouvelle('Chloé', null);
		await reglerEte(base, chef, 2027, periodeParDefaut(2027, reglage), maintenant, reglage);
		const id = await ajouterMesVacances(base, alice, 2027, { debut: '2027-07-10', fin: '2027-07-20' }, maintenant);
		await ajouterMesVacances(base, alice, 2027, { debut: '2027-08-01', fin: '2027-08-05' }, maintenant);
		await expect(ajouterMesVacances(base, alice, 2027, { debut: '2027-07-20', fin: '2027-07-10' }, maintenant)).rejects.toThrow('Fin avant le début');
		await expect(ajouterMesVacances(base, alice, 2027, { debut: '2027-10-01', fin: '2027-10-05' }, maintenant)).rejects.toThrow('Hors de l’été');
		await expect(ajouterMesVacances(base, alice, 2027, { debut: '2027-07-15', fin: '2027-07-25' }, maintenant)).rejects.toThrow('Chevauche une autre période');
		await toutLete(base, bruno, 2027, maintenant);
		const miennes = await mesVacances(base, alice, maintenant);
		expect(miennes).toMatchObject({ ete: { annee: 2027, debut: '2027-06-25', fin: '2027-09-03', dateLimite: '2027-05-15', publiee: false }, reponse: { toutEte: false } });
		expect(miennes.periodes.map((p) => [p.debut, p.fin])).toEqual([
			['2027-07-10', '2027-07-20'],
			['2027-08-01', '2027-08-05']
		]);
		// Une autre personne ne retire pas mes vacances.
		await expect(retirerMesVacances(base, bruno, id, maintenant)).rejects.toThrow(DonneeInvalide);
		await retirerMesVacances(base, alice, id, maintenant);
		expect((await mesVacances(base, alice, maintenant)).periodes).toHaveLength(1);
		// Tout l'été efface les périodes.
		await toutLete(base, alice, 2027, maintenant);
		expect(await mesVacances(base, alice, maintenant)).toMatchObject({ reponse: { toutEte: true }, periodes: [] });

		await expect(reponsesEte(base, alice, 2027, maintenant)).rejects.toThrow(RefusDroit);
		const r = await reponsesEte(base, chef, 2027, maintenant);
		expect(r.agents.map((x) => [x.prenom, x.reponse])).toEqual([
			['Alice', 'tout'],
			['Bruno', 'tout'],
			['David', null]
		]);
		expect(r.agents[2]!.id).toBe(david.type === 'personne' ? david.id : 0);
	});

	it('rappels un mois puis une semaine avant la date limite, à ceux qui n’ont rien saisi, une fois chacun', async () => {
		const { base, chef, nouvelle, a } = await jeuEte();
		const alice = a(await nouvelle('Alice', 1));
		const bruno = await nouvelle('Bruno', 2);
		await reglerEte(base, chef, 2027, periodeParDefaut(2027, reglage), maintenant, reglage);
		await ajouterMesVacances(base, alice, 2027, { debut: '2027-07-10', fin: '2027-07-20' }, maintenant);
		expect(await rappelsEte(base, '2027-04-14T08:00')).toBe(0);
		expect(await rappelsEte(base, '2027-04-15T08:00')).toBe(1);
		expect(await rappelsEte(base, '2027-04-16T08:00')).toBe(0);
		expect(await rappelsEte(base, '2027-05-08T08:00')).toBe(1);
		expect(await rappelsEte(base, '2027-05-09T08:00')).toBe(0);
		const avis = await base.select().from(avisEte);
		expect(avis.map((x) => [x.personneId, x.quoi])).toEqual([
			[bruno, 'rappel'],
			[bruno, 'rappel']
		]);
		expect(avis[0]!.texte).toBe('Donnez vos vacances d’été avant le 15/05/2027 : vos dates, ou « disponible tout l’été ».');
		const fil = await filDeNotifications(base, a(bruno), '2027-05-09T08:00');
		expect(fil.nonLues).toBe(2);
		expect(fil.lignes[0]).toMatchObject({ type: 'ete', titre: 'Vos vacances d’été', url: '/moi/vacances' });
	});
});

import { describe, expect, it } from 'vitest';
import { lireArmement } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

describe('réglages : armement des engins', () => {
	it('réservé à qui gère les listes', async () => {
		const { base, ordinaire } = await preparer();
		await expect(charger(load, locaux(base, ordinaire))).rejects.toMatchObject({ status: 403 });
	});

	it('les règles par défaut, puis enregistrées ; une valeur hors limites est refusée', async () => {
		const { base, referent } = await preparer();
		const l = locaux(base, referent);
		const { armement, aptitudes } = await charger(load, l);
		expect(armement.engins.map((e: { nom: string }) => e.nom)).toEqual(['VSAV', 'VTU', 'FPT']);
		const champs: [string, string][] = [];
		for (const e of armement.engins) for (const [p, n] of Object.entries(e.postes)) champs.push([`${e.nom}-${p}`, String(n)]);
		const cod2 = aptitudes.find((a: { nom: string }) => a.nom === 'COD2').id;
		champs.push(['niveau-cod2', String(cod2)], ['niveau-ca2', '']);
		const fpt = champs.findIndex(([c]) => c === 'FPT-agent');
		champs[fpt] = ['FPT-agent', '3'];
		expect(await envoyer(actions, 'enregistrer', l, champs)).toEqual({ cible: 'armement', succes: 'Règles d’armement enregistrées.' });
		const r = await lireArmement(base);
		expect(r.engins[2]!.postes.agent).toBe(3);
		expect(r.niveaux).toMatchObject({ cod2, ca2: null, ce: null });
		champs[fpt] = ['FPT-agent', '20'];
		expect(await envoyer(actions, 'enregistrer', l, champs)).toMatchObject({ status: 400 });
	});
});

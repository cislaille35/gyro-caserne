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
		expect(r.niveaux).toMatchObject({ cod2, ca2: null });
		champs[fpt] = ['FPT-agent', '20'];
		expect(await envoyer(actions, 'enregistrer', l, champs)).toMatchObject({ status: 400 });
	});

	it('le panneau d’un engin n’envoie que ses postes ; la correspondance, que les niveaux : le reste ne bouge pas', async () => {
		const { base, referent } = await preparer();
		const l = locaux(base, referent);
		const avant = await lireArmement(base);
		expect(await charger(load, l, {}, 'http://x/?engin=VSAV')).toMatchObject({ engin: 'VSAV' });
		expect(await charger(load, l, {}, 'http://x/?engin=Autre')).toMatchObject({ engin: null });
		await envoyer(actions, 'enregistrer', l, [['VSAV-ca2', '0'], ['VSAV-ca1', '1'], ['VSAV-ce', '1'], ['VSAV-cod1', '1'], ['VSAV-agent', '1']]);
		const apres = await lireArmement(base);
		expect(apres.engins[0]!.postes.cod1).toBe(1);
		expect(apres.engins.slice(1)).toEqual(avant.engins.slice(1));
		expect(apres.niveaux).toEqual(avant.niveaux);
		await envoyer(actions, 'enregistrer', l, [['niveau-ca2', ''], ['niveau-ca1', ''], ['niveau-ce', ''], ['niveau-cod2', ''], ['niveau-cod1', '']]);
		const sans = await lireArmement(base);
		expect(sans.niveaux).toEqual({ ca2: null, ca1: null, ce: null, cod2: null, cod1: null });
		expect(sans.engins).toEqual(apres.engins);
	});
});

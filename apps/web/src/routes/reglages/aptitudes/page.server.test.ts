import { describe, expect, it } from 'vitest';
import { aptitude } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

describe('réglages : aptitudes', () => {
	it('réservé à qui gère les listes', async () => {
		const { base, ordinaire } = await preparer();
		await expect(charger(load, locaux(base, ordinaire))).rejects.toMatchObject({ status: 403 });
	});

	it('liste, ajoute, renomme et rend « contrôlée », retire', async () => {
		const { base, referent } = await preparer();
		const l = locaux(base, referent);
		const { aptitudes } = await charger(load, l);
		expect(aptitudes.map((a: { nom: string }) => a.nom)).toContain('CA2');
		expect(await envoyer(actions, 'enregistrer', l, [['nom', 'SR'], ['controlee', 'oui']])).toEqual({ cible: 'nouvelle', succes: 'Aptitude SR ajoutée.' });
		const sr = (await base.select().from(aptitude)).find((a) => a.nom === 'SR')!;
		expect(sr.controlee).toBe(1);
		await envoyer(actions, 'enregistrer', l, [['id', String(sr.id)], ['nom', 'SR1']]);
		expect((await base.select().from(aptitude)).find((a) => a.id === sr.id)).toMatchObject({ nom: 'SR1', controlee: 0 });
		const double = await envoyer(actions, 'enregistrer', l, [['nom', 'ca2']]);
		expect(double).toMatchObject({ status: 400, data: { cible: 'nouvelle', erreurs: { nom: expect.stringContaining('déjà utilisé') } } });
		await envoyer(actions, 'retirer', l, [['id', String(sr.id)]]);
		expect((await charger(load, l)).aptitudes.some((a: { id: number }) => a.id === sr.id)).toBe(false);
	});
});

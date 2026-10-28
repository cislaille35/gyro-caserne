import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer } from '../src/actions/attributions.ts';
import { listerProfils, modifierDroitsProfil } from '../src/actions/profils.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { journal, personne, profil, profilDroit, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-28';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const donner = async (email: string, nomResp: string) => {
		const [p] = await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nomResp));
		await attribuer(base, superAdmin, { personneId: p!.id, responsabiliteId: r!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
		return { type: 'personne', id: p!.id } as Acteur;
	};
	const chef = await donner('chef@exemple.fr', 'Chef de centre');
	const adjoint = await donner('adjoint@exemple.fr', 'Chef de centre adjoint');
	const referent = await donner('ref@exemple.fr', 'Référent technique');
	const droitsDuProfil = async (id: number) =>
		(await base.select().from(profilDroit).where(eq(profilDroit.profilId, id))).map((l) => `${l.droit}@${l.perimetreType}${l.perimetreId ?? ''}`).sort();
	return { base, agent: agent!, chef, adjoint, referent, droitsDuProfil };
}

describe('listerProfils', () => {
	it('donne chaque profil et ses droits sur le centre', async () => {
		const { base, chef } = await jeu();
		const profils = await listerProfils(base, chef, aujourdhui);
		expect(profils.map((p) => p.nom)).toEqual(['Agent', 'Réserve citoyenne']);
		expect(profils[0]).toMatchObject({ typePersonne: 'agent' });
		expect(profils[0]!.droits).toContain('SIGNALER_ANOMALIE');
		expect(profils[0]!.droits).toHaveLength(10);
		expect(profils[1]!.droits).toEqual([]);
	});

	it('refuse le référent technique', async () => {
		const { base, referent } = await jeu();
		await expect(listerProfils(base, referent, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('modifierDroitsProfil', () => {
	it('le chef de centre modifie les droits, journalise avant et après', async () => {
		const { base, chef, agent, droitsDuProfil } = await jeu();
		const avant = (await listerProfils(base, chef, aujourdhui))[0]!.droits;
		const apres = [...avant.filter((d) => d !== 'UTILISER_MESSAGERIE'), 'RESERVER' as const];
		await modifierDroitsProfil(base, chef, agent.id, apres, aujourdhui);
		const lus = await droitsDuProfil(agent.id);
		expect(lus).toContain('RESERVER@centre');
		expect(lus).not.toContain('UTILISER_MESSAGERIE@centre');
		expect(lus).toHaveLength(10);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'modifier_droits_profil'));
		expect(ligne).toMatchObject({ cibleType: 'profil', cibleId: agent.id, acteur: `personne:${(chef as { id: number }).id}` });
		expect(JSON.parse(ligne!.details)).toEqual({ droits: { avant: [...avant].sort(), apres: [...apres].sort() } });
	});

	it('l’adjoint et le super administrateur modifient aussi ; rien n’est écrit si rien ne change', async () => {
		const { base, adjoint, agent } = await jeu();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		await modifierDroitsProfil(base, adjoint, reserve!.id, ['VOIR_PLANNING'], aujourdhui);
		await modifierDroitsProfil(base, superAdmin, reserve!.id, ['VOIR_PLANNING', 'VOIR_PLANNING'], aujourdhui);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_droits_profil'))).toHaveLength(1);
		const personneReserve = (await base.insert(personne).values({ email: 'r@exemple.fr', prenom: 'R', nom: 'C', profilId: reserve!.id }).returning())[0]!;
		expect(await aLeDroit(base, { type: 'personne', id: personneReserve.id }, 'VOIR_PLANNING', { type: 'centre' }, aujourdhui)).toBe(true);
		expect(agent.id).not.toBe(reserve!.id);
	});

	it('refuse le référent technique, rien n’est écrit', async () => {
		const { base, referent, agent, droitsDuProfil } = await jeu();
		const avant = await droitsDuProfil(agent.id);
		await expect(modifierDroitsProfil(base, referent, agent.id, ['VOIR_PLANNING'], aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		expect(await droitsDuProfil(agent.id)).toEqual(avant);
	});

	it('refuse un droit de pouvoir, un droit inconnu ou un profil inconnu', async () => {
		const { base, chef, agent, droitsDuProfil } = await jeu();
		const avant = await droitsDuProfil(agent.id);
		await expect(modifierDroitsProfil(base, chef, agent.id, ['VOIR_PLANNING', 'GERER_ACCES'], aujourdhui)).rejects.toThrow(new DonneeInvalide('Un profil ne donne pas de droit de pouvoir'));
		await expect(modifierDroitsProfil(base, superAdmin, agent.id, ['GERER_LISTES'], aujourdhui)).rejects.toThrow(new DonneeInvalide('Un profil ne donne pas de droit de pouvoir'));
		await expect(modifierDroitsProfil(base, chef, agent.id, ['N_IMPORTE_QUOI' as never], aujourdhui)).rejects.toThrow(new DonneeInvalide('Droit inconnu'));
		await expect(modifierDroitsProfil(base, chef, 999, ['VOIR_PLANNING'], aujourdhui)).rejects.toThrow(new DonneeInvalide('Profil inconnu'));
		expect(await droitsDuProfil(agent.id)).toEqual(avant);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_droits_profil'))).toHaveLength(0);
	});

	it('ne touche pas aux droits du profil hors périmètre centre', async () => {
		const { base, chef, agent } = await jeu();
		await base.insert(profilDroit).values({ profilId: agent.id, droit: 'LIRE_SALON', perimetreType: 'salon', perimetreId: 7 });
		await modifierDroitsProfil(base, chef, agent.id, ['VOIR_PLANNING'], aujourdhui);
		const salon = await base.select().from(profilDroit).where(and(eq(profilDroit.profilId, agent.id), eq(profilDroit.perimetreType, 'salon')));
		expect(salon).toHaveLength(1);
		expect((await listerProfils(base, chef, aujourdhui))[0]!.droits).toEqual(['VOIR_PLANNING']);
	});

	it('reste sous le budget de requêtes', async () => {
		const { base, chef, agent } = await jeu();
		base.requetes = 0;
		await modifierDroitsProfil(base, chef, agent.id, ['VOIR_PLANNING', 'RESERVER'], aujourdhui);
		expect(base.requetes).toBeLessThanOrEqual(10);
	});
});

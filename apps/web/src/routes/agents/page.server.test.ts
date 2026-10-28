import { describe, expect, it } from 'vitest';
import { affectationEquipe, equipe, personne } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { load } from './+layout.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (locals: unknown, requete = '') => (load as any)({ locals, url: new URL(`http://x/agents${requete}`) });
const super_ = { type: 'super', email: 'admin@exemple.fr' };

async function preparer() {
	const base = await baseDeTest();
	const [rouge] = await base.insert(equipe).values({ nom: 'Rouge', couleur: '#c00', ordreRotation: 1 }).returning();
	await base.insert(equipe).values({ nom: 'Ancienne', couleur: '#000', ordreRotation: 2, active: 0 });
	const [alice] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'Martin' }).returning();
	const [bob] = await base.insert(personne).values({ email: 'bob@exemple.fr', prenom: 'Bob', nom: 'Durand', statut: 'stagiaire' }).returning();
	await base.insert(personne).values({ email: 'zoe@exemple.fr', prenom: 'Zoé', nom: 'Zorro', statut: 'parti' });
	await base.insert(affectationEquipe).values({ personneId: alice!.id, equipeId: rouge!.id, debut: '2026-01-01' });
	return { base, alice: alice!, bob: bob!, rouge: rouge! };
}

describe('load de /agents', () => {
	it('renvoie vers la connexion si personne n\'est connecté', async () => {
		const base = await baseDeTest();
		await expect(appeler({ acteur: null, base })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('donne la vue de tous à un agent ordinaire, sans donnée de gestion', async () => {
		const { base, alice } = await preparer();
		const data = await appeler({ acteur: { type: 'personne', id: alice.id }, base });
		expect(data.gestion).toBe(false);
		expect(data.groupes.map((g: { titre: string }) => g.titre)).toEqual(['Rouge', 'Sans équipe']);
		expect(data.groupes[0].equipe).toEqual({ couleur: '#c00', chefs: [] });
		const brut = JSON.stringify(data);
		expect(brut).not.toContain('@exemple.fr');
		expect(brut).not.toContain('Zorro');
		for (const statut of ['parti', 'stagiaire', 'operationnel', 'suspendu']) expect(brut).not.toContain(statut);
		expect(data.comptes).toBeUndefined();
		expect(data.filtres).toBeUndefined();
	});

	it('donne au super administrateur la liste par équipe, les comptes et les filtres', async () => {
		const { base } = await preparer();
		const data = await appeler({ acteur: super_, base });
		expect(data.gestion).toBe(true);
		expect(data.groupes.map((g: { titre: string; personnes: { prenom: string }[] }) => [g.titre, g.personnes.map((p) => p.prenom)])).toEqual([
			['Rouge', ['Alice']],
			['Sans équipe', ['Bob']],
			['Partis', ['Zoé']]
		]);
		expect(data.groupes[0].personnes[0]).toMatchObject({ email: 'alice@exemple.fr', statut: 'operationnel', aCompleter: true });
		expect(data.comptes).toEqual({ 'a-completer': 2, indisponibles: 0, partis: 1 });
		expect(data.filtres).toEqual({ texte: '', filtre: '' });
	});

	it('applique la recherche et le filtre de l\'URL et les renvoie', async () => {
		const { base } = await preparer();
		const prenoms = (data: { groupes: { personnes: { prenom: string }[] }[] }) => data.groupes.flatMap((g) => g.personnes.map((p) => p.prenom));
		expect(prenoms(await appeler({ acteur: super_, base }, '?texte=bob'))).toEqual(['Bob']);
		// Un stagiaire part en intervention : il n'est pas indisponible.
		const indispo = await appeler({ acteur: super_, base }, '?filtre=indisponibles');
		expect(prenoms(indispo)).toEqual([]);
		expect(indispo.filtres).toEqual({ texte: '', filtre: 'indisponibles' });
		const partis = await appeler({ acteur: super_, base }, '?texte=zo&filtre=partis');
		expect(prenoms(partis)).toEqual(['Zoé']);
		expect(partis.filtres).toEqual({ texte: 'zo', filtre: 'partis' });
	});

	it('ignore un filtre invalide', async () => {
		const { base } = await preparer();
		const data = await appeler({ acteur: super_, base }, '?filtre=zzz');
		expect(data.groupes.flatMap((g: { personnes: unknown[] }) => g.personnes)).toHaveLength(3);
		expect(data.filtres).toEqual({ texte: '', filtre: '' });
	});
});

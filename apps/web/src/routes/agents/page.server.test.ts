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
		const brut = JSON.stringify(data);
		expect(brut).not.toContain('@exemple.fr');
		expect(brut).not.toContain('Zorro');
		for (const statut of ['parti', 'stagiaire', 'operationnel', 'suspendu']) expect(brut).not.toContain(statut);
		expect(data.lignes).toBeUndefined();
	});

	it('donne la liste de gestion au super administrateur', async () => {
		const { base } = await preparer();
		const data = await appeler({ acteur: super_, base });
		expect(data.gestion).toBe(true);
		expect(data.lignes.map((l: { prenom: string }) => l.prenom)).toEqual(['Bob', 'Alice', 'Zoé']);
		expect(data.equipes.map((e: { nom: string }) => e.nom)).toEqual(['Rouge']);
		expect(data.statuts).toContain('stagiaire');
		expect(data.filtres).toEqual({ texte: '', equipe: '', statut: '' });
	});

	it('applique les filtres de l\'URL et les renvoie', async () => {
		const { base, rouge } = await preparer();
		const parTexte = await appeler({ acteur: super_, base }, '?texte=bob');
		expect(parTexte.lignes.map((l: { prenom: string }) => l.prenom)).toEqual(['Bob']);
		const parEquipe = await appeler({ acteur: super_, base }, `?equipe=${rouge.id}`);
		expect(parEquipe.lignes.map((l: { prenom: string }) => l.prenom)).toEqual(['Alice']);
		const sans = await appeler({ acteur: super_, base }, '?equipe=aucune&statut=stagiaire');
		expect(sans.lignes.map((l: { prenom: string }) => l.prenom)).toEqual(['Bob']);
		expect(sans.filtres).toEqual({ texte: '', equipe: 'aucune', statut: 'stagiaire' });
	});

	it('ignore un filtre d\'équipe ou de statut invalide', async () => {
		const { base } = await preparer();
		const data = await appeler({ acteur: super_, base }, '?equipe=abc&statut=zzz');
		expect(data.lignes).toHaveLength(3);
		expect(data.filtres).toEqual({ texte: '', equipe: '', statut: '' });
	});
});

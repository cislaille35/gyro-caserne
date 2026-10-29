import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { apercusDesMurs } from '../src/apercus.ts';
import type { Acteur } from '../src/droits.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { mursDe } from '../src/murs.ts';
import { attribution, comite, equipe, personne, profil, publication, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-28';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.typePersonne, 'agent'));
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const [chefRole] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	const nouvelle = async (prenom: string) =>
		(await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id, statut: 'operationnel' }).returning())[0]!.id;
	const chef = await nouvelle('Chef');
	await base.insert(attribution).values({ personneId: chef, responsabiliteId: chefRole!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', fin: null, saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const publier = (mur: string, auteur: string, texte: string, creeLe: string) =>
		base.insert(publication).values({ mur, auteur, type: 'message', texte, creeLe });
	return { base, nouvelle, chef, publier, e1: equipes[0]!, amicale: amicale! };
}

describe('apercusDesMurs', () => {
	it('suit l’ordre de mursDe, un mur vide a derniere null', async () => {
		const { base, chef } = await jeu();
		const apercus = await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		const murs = await mursDe(base, { type: 'personne', id: chef }, aujourdhui);
		expect(apercus.map((a) => a.cle)).toEqual(murs.map((m) => m.cle));
		expect(apercus.every((a) => a.derniere === null)).toBe(true);
	});

	it('donne la dernière publication : prénom, texte, date', async () => {
		const { base, chef, nouvelle, publier } = await jeu();
		const lea = await nouvelle('Léa');
		await publier('centre', `personne:${lea}`, 'Ancien', '2026-10-01T08:00:00Z');
		await publier('centre', `personne:${lea}`, 'Récent', '2026-10-02T08:00:00Z');
		await publier('vie', 'super:admin@exemple.fr', 'Salut', '2026-10-03T08:00:00Z');
		await publier('vie', `personne:9999`, 'Parti', '2026-10-04T08:00:00Z');
		const a = await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		expect(a.find((x) => x.cle === 'centre')!.derniere).toEqual({ auteur: 'Léa', texte: 'Récent', creeLe: '2026-10-02T08:00:00Z' });
		expect(a.find((x) => x.cle === 'vie')!.derniere).toEqual({ auteur: 'Personne inconnue', texte: 'Parti', creeLe: '2026-10-04T08:00:00Z' });
	});

	it('un super administrateur auteur s’affiche « Super administrateur »', async () => {
		const { base, chef, publier } = await jeu();
		await publier('centre', 'super:admin@exemple.fr', 'Salut', '2026-10-03T08:00:00Z');
		const a = await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		expect(a[0]!.derniere!.auteur).toBe('Super administrateur');
	});

	it('met le texte sur une ligne et le tronque à 80 caractères avec « … »', async () => {
		const { base, chef, publier } = await jeu();
		await publier('centre', 'super:a@b.fr', 'Ligne un\n\nligne   deux ' + 'x'.repeat(100), '2026-10-03T08:00:00Z');
		await publier('vie', 'super:a@b.fr', 'a'.repeat(80), '2026-10-03T08:00:00Z');
		const a = await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		const texte = a[0]!.derniere!.texte;
		expect(texte).toHaveLength(80);
		expect(texte.endsWith('…')).toBe(true);
		expect(texte.startsWith('Ligne un ligne deux ')).toBe(true);
		expect(a[1]!.derniere!.texte).toBe('a'.repeat(80));
	});

	it('tronque par caractères : jamais un emoji coupé, pas d’espace avant « … »', async () => {
		const { base, chef, publier } = await jeu();
		await publier('centre', 'super:a@b.fr', '🚒'.repeat(100), '2026-10-03T08:00:00Z');
		await publier('vie', 'super:a@b.fr', '🎂'.repeat(80), '2026-10-03T08:00:00Z');
		const a = await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		expect(a[0]!.derniere!.texte).toBe(`${'🚒'.repeat(79)}…`);
		expect(a[1]!.derniere!.texte).toBe('🎂'.repeat(80));
		await publier('centre', 'super:a@b.fr', `${'a'.repeat(78)} ${'b'.repeat(10)}`, '2026-10-04T08:00:00Z');
		expect((await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui))[0]!.derniere!.texte).toBe(`${'a'.repeat(78)}…`);
	});

	it('super administrateur : membre faux partout', async () => {
		const { base } = await jeu();
		const a = await apercusDesMurs(base, superAdmin, aujourdhui);
		expect(a.length).toBeGreaterThan(2);
		expect(a.every((x) => !x.membre)).toBe(true);
	});

	it('chef de centre : membre du centre et de Vie, pas d’une équipe dont il ne fait pas partie', async () => {
		const { base, chef, e1 } = await jeu();
		const a = await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		expect(a.find((x) => x.cle === 'centre')!.membre).toBe(true);
		expect(a.find((x) => x.cle === 'vie')!.membre).toBe(true);
		expect(a.find((x) => x.cle === `equipe:${e1.id}`)!.membre).toBe(false);
	});

	it('identité : maison, ballon, équipe (couleur, numéro), comité (icône du thème ou choisie)', async () => {
		const { base, chef, e1, amicale } = await jeu();
		await base.update(comite).set({ icone: 'livre' }).where(eq(comite.id, amicale.id));
		const a = await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		expect(a.find((x) => x.cle === 'centre')).toMatchObject({ icone: 'maison', couleur: null, numero: null });
		expect(a.find((x) => x.cle === 'vie')).toMatchObject({ icone: 'ballon', couleur: null, numero: null });
		expect(a.find((x) => x.cle === `equipe:${e1.id}`)).toMatchObject({ icone: null, couleur: e1.couleur, numero: e1.ordreRotation });
		expect(a.find((x) => x.cle === `comite:${amicale.id}`)).toMatchObject({ icone: 'livre', couleur: null, numero: null });
		await base.update(comite).set({ icone: null }).where(eq(comite.id, amicale.id));
		const b = await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		expect(b.find((x) => x.cle === `comite:${amicale.id}`)!.icone).toBe('coeur');
	});

	it('deux requêtes au plus', async () => {
		const { base, chef, publier } = await jeu();
		await publier('centre', 'super:a@b.fr', 'Salut', '2026-10-03T08:00:00Z');
		const avant = base.requetes;
		await apercusDesMurs(base, { type: 'personne', id: chef }, aujourdhui);
		expect(base.requetes - avant).toBeLessThanOrEqual(2);
	});
});

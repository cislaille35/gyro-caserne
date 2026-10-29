import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { attribution, comite, lireMur, personne, publier, repondreEvenement, responsabilite } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer } from './de-test.ts';
import { load } from './+layout.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, url: object = new URL('http://x/echanges')) => (load as any)({ locals, url });

type Tuile = { cle: string; membre: boolean };

// Des comités dont la personne est membre ; leurs identifiants dans l'ordre donné.
async function comites(base: Parameters<typeof publier>[0], qui: { id: number }, noms: string[]) {
	const [membre] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Membre de comité'));
	const ids: number[] = [];
	for (const nom of noms) {
		const [c] = await base.insert(comite).values({ nom, theme: 'autre' }).returning();
		await base.insert(attribution).values({ personneId: qui.id, responsabiliteId: membre!.id, perimetreType: 'comite', perimetreId: c!.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		ids.push(c!.id);
	}
	return ids;
}

describe('liste des murs', () => {
	it('demande la connexion', async () => {
		await expect(charger({ acteur: null })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('montre les murs de la personne, leur aperçu et leurs nouveautés', async () => {
		const { base, chef, alice, e1 } = await preparer();
		await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis());
		await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Encore' }, maintenantParis());
		const { sections } = await charger(locaux(base, alice));
		expect(sections.centre).toMatchObject({ cle: 'centre', nom: 'Le centre', type: 'centre', lectureSeule: false, nouveautes: 0, aConfirmer: 0, icone: 'maison', derniere: null });
		expect(sections.groupes.map((t: Tuile) => t.cle)).toEqual([`equipe:${e1.id}`, 'vie']);
		expect(sections.groupes[0]).toMatchObject({ nom: e1.nom, type: 'equipe', membre: true, numero: e1.ordreRotation, couleur: e1.couleur });
		expect(sections.groupes[1]).toMatchObject({ nouveautes: 2, icone: 'ballon', derniere: { auteur: 'Chef', texte: 'Encore' } });
		expect(sections.autres).toEqual([]);
		expect(sections.supervision).toEqual([]);
	});

	it('comités : ceux qui ont du neuf dans Mes groupes ; plus de deux sans nouveauté vont dans « Autres comités »', async () => {
		const { base, chef, alice, e1 } = await preparer();
		const ids = await comites(base, alice, ['Comité A', 'Comité B', 'Comité C', 'Comité D']);
		await publier(base, base.photos, chef, `comite:${ids[2]}`, { type: 'message', texte: 'Du neuf' }, maintenantParis());
		const { sections } = await charger(locaux(base, alice));
		expect(sections.groupes.map((t: Tuile) => t.cle)).toEqual([`equipe:${e1.id}`, 'vie', `comite:${ids[2]}`]);
		expect(sections.autres.map((t: Tuile) => t.cle)).toEqual([`comite:${ids[0]}`, `comite:${ids[1]}`, `comite:${ids[3]}`]);
	});

	it('deux comités sans nouveauté au plus : ils restent dans Mes groupes', async () => {
		const { base, alice, e1 } = await preparer();
		const ids = await comites(base, alice, ['Comité A', 'Comité B']);
		const { sections } = await charger(locaux(base, alice));
		expect(sections.groupes.map((t: Tuile) => t.cle)).toEqual([`equipe:${e1.id}`, 'vie', `comite:${ids[0]}`, `comite:${ids[1]}`]);
		expect(sections.autres).toEqual([]);
	});

	it('chef de centre : les équipes et comités dont il n’est pas membre vont dans Supervision', async () => {
		const { base, chef, e1, e2 } = await preparer();
		const { sections } = await charger(locaux(base, chef));
		expect(sections.centre.cle).toBe('centre');
		expect(sections.groupes.map((t: Tuile) => t.cle)).toEqual(['vie']);
		const supervision = sections.supervision.map((t: Tuile) => t.cle);
		expect(supervision).toEqual(expect.arrayContaining([`equipe:${e1.id}`, `equipe:${e2.id}`]));
		expect(supervision).not.toContain('centre');
		expect(supervision).not.toContain('vie');
		expect(sections.supervision.every((t: Tuile) => t.membre === false)).toBe(true);
	});

	it('super administrateur : Mes groupes vide, tout ce qu’il voit dans Supervision, Aujourd’hui sans événement', async () => {
		const { base, chef, alice } = await preparer();
		await publier(base, base.photos, chef, 'centre', { type: 'evenement', texte: 'Manœuvre', evenement: { debut: '2099-01-01T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenantParis());
		await base.update(personne).set({ naissance: `1990-${aujourdhuiParis().slice(5)}` }).where(eq(personne.id, alice.id));
		const data = await charger(locaux(base, { type: 'super', email: 'admin@exemple.fr' }));
		expect(data.sections.centre.cle).toBe('centre');
		expect(data.sections.groupes).toEqual([]);
		expect(data.sections.autres).toEqual([]);
		expect(data.sections.supervision.map((t: Tuile) => t.cle)).toContain('vie');
		expect(data.sections.supervision.length).toBeGreaterThan(3);
		expect(data.aujourdhui).toEqual({ anniversaires: [{ prenom: 'Alice', nom: 'Test' }], evenement: null });
	});

	it('Le centre : le nombre d’annonces à confirmer, sans celles des autres murs', async () => {
		const { base, chef, alice } = await preparer();
		await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Consigne', priseDeConnaissance: true }, maintenantParis());
		await publier(base, base.photos, chef, 'centre', { type: 'annonce', texte: 'Autre', priseDeConnaissance: true }, maintenantParis());
		await publier(base, base.photos, chef, 'vie', { type: 'annonce', texte: 'Sur Vie', priseDeConnaissance: true }, maintenantParis());
		const { sections } = await charger(locaux(base, alice));
		expect(sections.centre.aConfirmer).toBe(2);
		expect(sections.groupes.find((t: Tuile) => t.cle === 'vie').aConfirmer).toBe(1);
	});

	it('Aujourd’hui : les anniversaires et le premier événement convoqué sans réponse', async () => {
		const { base, chef, alice } = await preparer();
		const evenement = (texte: string, debut: string) => publier(base, base.photos, chef, 'centre', { type: 'evenement', texte, evenement: { debut, lieu: 'Caserne', convoques: 'tous' } }, maintenantParis());
		const repondu = await evenement('Repas', '2099-01-01T12:00');
		const attendu = await evenement('Manœuvre', '2099-01-02T19:00');
		await evenement('Plus tard', '2099-01-03T19:00');
		await repondreEvenement(base, alice, repondu, 'present', maintenantParis());
		const vide = await charger(locaux(base, chef));
		expect(vide.aujourdhui.anniversaires).toEqual([]);
		const { aujourdhui } = await charger(locaux(base, alice));
		expect(aujourdhui.evenement).toEqual({ id: attendu, cle: 'centre', titre: 'Manœuvre', debut: '2099-01-02T19:00' });
	});

	it('À venir : les 3 prochains événements où la personne est convoquée, répondus ou non', async () => {
		const { base, chef, alice, e2 } = await preparer();
		const evenement = (texte: string, debut: string, convoques: 'tous' | number[] = 'tous') =>
			publier(base, base.photos, chef, 'centre', { type: 'evenement', texte, evenement: { debut, lieu: 'Caserne', convoques } }, maintenantParis());
		// Publiés dans le désordre : « À venir » les trie par date.
		const sport = await evenement('Sport', '2099-01-03T19:00');
		await evenement('Plus tard', '2099-01-04T19:00');
		const manoeuvre = await evenement('Manœuvre', '2099-01-02T19:00');
		await evenement('Pour l’équipe 2', '2099-01-01T18:00', [e2.id]);
		const repas = await evenement('Repas', '2099-01-01T12:00');
		await repondreEvenement(base, alice, repas, 'present', maintenantParis());
		const { aVenir } = await charger(locaux(base, alice));
		expect(aVenir).toEqual([
			{ id: repas, cle: 'centre', nomMur: 'Le centre', titre: 'Repas', debut: '2099-01-01T12:00' },
			{ id: manoeuvre, cle: 'centre', nomMur: 'Le centre', titre: 'Manœuvre', debut: '2099-01-02T19:00' },
			{ id: sport, cle: 'centre', nomMur: 'Le centre', titre: 'Sport', debut: '2099-01-03T19:00' }
		]);
	});

	it('se recharge à chaque changement d’adresse : la pastille d’un mur visité disparaît', async () => {
		const { base, chef, alice } = await preparer();
		await publier(base, base.photos, chef, 'vie', { type: 'message', texte: 'Bonjour' }, maintenantParis());
		// SvelteKit ne relance ce chargement que s'il a lu l'adresse.
		let lue = false;
		const url = {
			get pathname() {
				lue = true;
				return '/echanges/centre';
			}
		};
		await charger(locaux(base, alice), url);
		expect(lue).toBe(true);
		await lireMur(base, alice, 'vie', {}, maintenantParis());
		const apres = await charger(locaux(base, alice), new URL('http://x/echanges/centre'));
		expect(apres.sections.groupes.find((m: { cle: string }) => m.cle === 'vie').nouveautes).toBe(0);
	});
});

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { anniversairesDuJour, monAnniversaire } from '../src/a-ne-pas-manquer.ts';
import { changerStatut, modifierMonProfil } from '../src/actions/personnes.ts';
import { abonner, enTeteDe, filDeNotifications, marquerLue, toutMarquerLu } from '../src/notifications.ts';
import { effacerSouhaitsPasses, souhaiter } from '../src/souhaits.ts';
import { envoiPush, personne, profil, souhaitAnniversaire } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-28';
const maintenant = '2026-10-28T09:15:00';
const acteur = (id: number): Acteur => ({ type: 'personne', id });
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

// Zoé fête son anniversaire aujourd'hui ; Paul et Marc sont ses collègues. Chacun a un téléphone abonné.
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const nouvelle = async (prenom: string, champs: Partial<typeof personne.$inferInsert> = {}) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id, ...champs }).returning();
		await abonner(base, acteur(p!.id), { endpoint: `https://fcm.googleapis.com/fcm/send/${prenom}`, p256dh: 'BCle', auth: 'secret', appareil: 'Téléphone' }, maintenant);
		return p!.id;
	};
	const zoe = await nouvelle('Zoe', { nom: 'Bernard', naissance: '1990-10-28' });
	const paul = await nouvelle('Paul', { nom: 'Martin' });
	const marc = await nouvelle('Marc', { nom: 'Petit' });
	const envois = async (id: number) => (await base.select({ donnees: envoiPush.donnees }).from(envoiPush)).map((e) => JSON.parse(e.donnees)).filter((d) => d.tag === `anniversaire:${id}`);
	return { base, nouvelle, zoe, paul, marc, envois };
}

describe('souhaiter un anniversaire', () => {
	it('écrit le souhait et prévient l’agent fêté (cloche et téléphone), en deux requêtes', async () => {
		const { base, zoe, paul, envois } = await jeu();
		base.requetes = 0;
		await souhaiter(base, acteur(paul), zoe, maintenant);
		expect(base.requetes).toBe(2);
		expect(await base.select().from(souhaitAnniversaire)).toMatchObject([{ personneId: zoe, auteurId: paul, jour: aujourdhui, lueLe: null }]);
		const [souhait] = await base.select().from(souhaitAnniversaire);
		expect(await envois(paul)).toEqual([{ titre: 'Joyeux anniversaire', texte: 'Paul Martin vous souhaite un joyeux anniversaire 🎂', url: '/', tag: `anniversaire:${paul}`, lue: { genre: 'anniversaire', id: souhait!.id } }]);
	});

	it('une seule fois par collègue et par anniversaire', async () => {
		const { base, zoe, paul, envois } = await jeu();
		await souhaiter(base, acteur(paul), zoe, maintenant);
		await souhaiter(base, acteur(paul), zoe, '2026-10-28T10:00:00');
		expect(await base.select().from(souhaitAnniversaire)).toHaveLength(1);
		expect(await envois(paul)).toHaveLength(1);
	});

	it('refusé : à soi-même, sans anniversaire aujourd’hui, anniversaire masqué, agent parti, super administrateur', async () => {
		const { base, nouvelle, zoe, paul } = await jeu();
		const cache = await nouvelle('Cache', { naissance: '1990-10-28', anniversaireVisible: 0 });
		const parti = await nouvelle('Parti', { naissance: '1990-10-28', statut: 'parti' });
		await expect(souhaiter(base, acteur(zoe), zoe, maintenant)).rejects.toThrow('On ne se souhaite pas son propre anniversaire');
		for (const id of [paul, cache, parti, 9999]) await expect(souhaiter(base, acteur(zoe), id, maintenant)).rejects.toThrow('Pas d’anniversaire à souhaiter aujourd’hui');
		await expect(souhaiter(base, superAdmin, zoe, maintenant)).rejects.toBeInstanceOf(DonneeInvalide);
		expect(await base.select().from(souhaitAnniversaire)).toEqual([]);
	});
});

describe('anniversaires du jour, vus par un collègue', () => {
	it('le geste : souhaiter, déjà souhaité, ou rien pour soi-même et le super administrateur', async () => {
		const { base, zoe, paul, marc } = await jeu();
		await souhaiter(base, acteur(paul), zoe, maintenant);
		expect(await anniversairesDuJour(base, acteur(paul), aujourdhui)).toEqual([{ id: zoe, prenom: 'Zoe', nom: 'Bernard', geste: 'souhaite' }]);
		expect(await anniversairesDuJour(base, acteur(marc), aujourdhui)).toEqual([{ id: zoe, prenom: 'Zoe', nom: 'Bernard', geste: 'souhaiter' }]);
		expect(await anniversairesDuJour(base, acteur(zoe), aujourdhui)).toEqual([{ id: zoe, prenom: 'Zoe', nom: 'Bernard', geste: null }]);
		expect(await anniversairesDuJour(base, superAdmin, aujourdhui)).toEqual([{ id: zoe, prenom: 'Zoe', nom: 'Bernard', geste: null }]);
	});
});

describe('mon anniversaire : qui me l’a souhaité', () => {
	it('les collègues, dans l’ordre des souhaits ; null hors du jour', async () => {
		const { base, zoe, paul, marc } = await jeu();
		expect(await monAnniversaire(base, acteur(zoe), aujourdhui)).toEqual({ souhaitePar: [] });
		await souhaiter(base, acteur(marc), zoe, maintenant);
		await souhaiter(base, acteur(paul), zoe, '2026-10-28T10:00:00');
		expect(await monAnniversaire(base, acteur(zoe), aujourdhui)).toEqual({ souhaitePar: [{ prenom: 'Marc', nom: 'Petit' }, { prenom: 'Paul', nom: 'Martin' }] });
		expect(await monAnniversaire(base, acteur(paul), aujourdhui)).toBeNull();
	});
});

describe('dans la cloche de l’agent fêté', () => {
	it('une ligne par souhait, non lue, comptée ; marquée lue une à une ou toutes', async () => {
		const { base, zoe, paul, marc } = await jeu();
		await souhaiter(base, acteur(paul), zoe, maintenant);
		const { lignes } = await filDeNotifications(base, acteur(zoe), maintenant);
		const [souhait] = await base.select().from(souhaitAnniversaire);
		expect(lignes).toEqual([{ id: souhait!.id, type: 'anniversaire', auteur: { prenom: 'Paul', nom: 'Martin', couleur: null }, creeLe: maintenant, lue: false }]);
		expect((await enTeteDe(base, acteur(zoe), aujourdhui)).nonLues).toBe(1);
		// Paul ne marque pas lue la ligne de Zoé.
		await marquerLue(base, acteur(paul), 'anniversaire', souhait!.id, maintenant);
		expect((await enTeteDe(base, acteur(zoe), aujourdhui)).nonLues).toBe(1);
		await marquerLue(base, acteur(zoe), 'anniversaire', souhait!.id, maintenant);
		expect((await enTeteDe(base, acteur(zoe), aujourdhui)).nonLues).toBe(0);
		await souhaiter(base, acteur(marc), zoe, maintenant);
		await toutMarquerLu(base, acteur(zoe), maintenant);
		expect((await enTeteDe(base, acteur(zoe), aujourdhui)).nonLues).toBe(0);
	});
});

describe('effacés vite', () => {
	it('la nuit : ceux des jours passés', async () => {
		const { base, zoe, paul } = await jeu();
		await souhaiter(base, acteur(paul), zoe, maintenant);
		await effacerSouhaitsPasses(base, aujourdhui);
		expect(await base.select().from(souhaitAnniversaire)).toHaveLength(1);
		await effacerSouhaitsPasses(base, '2026-10-29');
		expect(await base.select().from(souhaitAnniversaire)).toEqual([]);
	});

	it('l’agent masque son anniversaire ou change sa date : ses souhaits partent', async () => {
		const { base, zoe, paul, marc } = await jeu();
		await souhaiter(base, acteur(paul), zoe, maintenant);
		await modifierMonProfil(base, acteur(zoe), { surnom: 'Zo' }, aujourdhui);
		expect(await base.select().from(souhaitAnniversaire)).toHaveLength(1);
		await modifierMonProfil(base, acteur(zoe), { anniversaireVisible: false }, aujourdhui);
		expect(await base.select().from(souhaitAnniversaire)).toEqual([]);
		await modifierMonProfil(base, acteur(zoe), { anniversaireVisible: true }, aujourdhui);
		await souhaiter(base, acteur(marc), zoe, maintenant);
		await modifierMonProfil(base, acteur(zoe), { naissance: '1990-10-29' }, aujourdhui);
		expect(await base.select().from(souhaitAnniversaire)).toEqual([]);
	});

	it('au départ de l’agent fêté ou de l’auteur', async () => {
		const { base, zoe, paul, marc } = await jeu();
		await souhaiter(base, acteur(paul), zoe, maintenant);
		await souhaiter(base, acteur(marc), zoe, maintenant);
		await changerStatut(base, base.photos, superAdmin, paul, 'parti', maintenant.slice(0, 16));
		expect((await base.select().from(souhaitAnniversaire)).map((s) => s.auteurId)).toEqual([marc]);
		await changerStatut(base, base.photos, superAdmin, zoe, 'parti', maintenant.slice(0, 16));
		expect(await base.select().from(souhaitAnniversaire)).toEqual([]);
	});
});

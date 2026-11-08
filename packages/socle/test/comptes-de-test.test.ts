import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { acteurDe } from '../src/connexion.ts';
import { chargerComptesDeTest, COMPTES_DE_TEST } from '../src/comptes-de-test.ts';
import { aLeDroit } from '../src/droits.ts';
import { DonneeInvalide } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { mursDe } from '../src/murs.ts';
import { ajouterPersonne } from '../src/actions/personnes.ts';
import { nombreAValider } from '../src/reservations.ts';
import { comite, demandeHabillement, equipe, journal, personne, profil, publication, reservation, ressource } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-29T10:00';
const aujourdhui = '2026-10-29';

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
	return base;
}

async function mursDuCompte(base: Awaited<ReturnType<typeof baseDeTest>>, role: string) {
	const acteur = await acteurDe(base, `caserne+${role}@exemple.fr`, []);
	expect(acteur).not.toBeNull();
	return mursDe(base, acteur!, aujourdhui);
}

describe('chargerComptesDeTest', () => {
	it('crée un compte par profil, à l’adresse boîte+rôle', async () => {
		const base = await jeu();
		const adresses = (await base.select({ email: personne.email }).from(personne)).map((p) => p.email).sort();
		expect(adresses).toEqual(COMPTES_DE_TEST.map((c) => `caserne+${c.role}@exemple.fr`).sort());
		for (const c of COMPTES_DE_TEST) expect(await acteurDe(base, `caserne+${c.role}@exemple.fr`, [])).not.toBeNull();
	});

	it('donne à chaque compte les murs de son profil', async () => {
		const base = await jeu();
		const cles = async (role: string) => (await mursDuCompte(base, role)).map((m) => m.cle);
		expect((await cles('chef')).length).toBe(8);
		expect(await cles('agent')).toEqual(['centre', 'vie', 'equipe:1']);
		expect(await cles('exterieur')).toEqual([]);
		const amicale = (await mursDuCompte(base, 'rapporteur')).find((m) => m.nom === 'Amicale');
		expect(amicale?.peutModerer).toBe(true);
		const equipe1 = (await mursDuCompte(base, 'chef-equipe')).find((m) => m.cle === 'equipe:1');
		expect(equipe1?.peutModerer).toBe(true);
	});

	it('remplit les murs avec chaque sorte de publication', async () => {
		const base = await jeu();
		const pubs = await base.select().from(publication);
		expect(new Set(pubs.map((p) => p.mur.split(':')[0]))).toEqual(new Set(['centre', 'vie', 'equipe', 'comite']));
		expect(new Set(pubs.map((p) => p.type))).toEqual(new Set(['message', 'annonce', 'evenement', 'bravo']));
		expect(pubs.some((p) => p.priseDeConnaissance === 1 && p.epinglee === 1)).toBe(true);
		expect(pubs.some((p) => p.sondageQuestion !== null)).toBe(true);
		expect(pubs.filter((p) => p.type === 'evenement').every((p) => p.debut! > maintenant)).toBe(true);
	});

	it('du matériel de l’amicale et une demande de l’agent qui attend l’amicale ; le référent engins gère la VL', async () => {
		const base = await jeu();
		expect((await base.select().from(ressource)).map((r) => [r.nom, r.stock])).toEqual([
			['VL', null],
			['Bancs', 12],
			['Tables', 6],
			['Barnum', 1]
		]);
		expect(await base.select({ etat: reservation.etat, quantite: reservation.quantite, debut: reservation.debut }).from(reservation)).toEqual([{ etat: 'attente', quantite: 4, debut: '2026-11-08' }]);
		const membre = await acteurDe(base, 'caserne+membre@exemple.fr', []);
		expect(await nombreAValider(base, membre!, aujourdhui)).toBe(1);
		await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		expect(await base.select().from(ressource)).toHaveLength(4);
		expect(await base.select().from(reservation)).toHaveLength(1);
	});

	it('un référent habillement fictif et des demandes de l’agent et du membre à différentes étapes, sans doublon au second chargement', async () => {
		const base = await jeu();
		const referent = await acteurDe(base, 'caserne+habillement@exemple.fr', []);
		expect(await aLeDroit(base, referent!, 'GERER_HABILLEMENT', { type: 'centre' }, aujourdhui)).toBe(true);
		const etapes = async () => (await base.select({ etape: demandeHabillement.etape }).from(demandeHabillement).orderBy(demandeHabillement.id)).map((d) => d.etape);
		expect(await etapes()).toEqual(['demandee', 'question', 'traitee', 'livree']);
		await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		expect(await etapes()).toHaveLength(4);
	});

	it('ne fait rien la deuxième fois', async () => {
		const base = await jeu();
		const avant = (await base.select().from(publication)).length;
		await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		expect((await base.select().from(publication)).length).toBe(avant);
		expect((await base.select().from(personne).where(eq(personne.email, 'caserne+chef@exemple.fr'))).length).toBe(1);
	});

	it('le chef de garde s’appelle « Chef-de-Garde » ; un compte déjà créé sous l’ancien nom est renommé, même adresse', async () => {
		expect(COMPTES_DE_TEST.find((c) => c.role === 'chef-equipe')).toMatchObject({ prenom: 'Élodie', nom: 'Chef-de-Garde' });
		const base = await jeu();
		await base.update(personne).set({ nom: 'Chef-Équipe' }).where(eq(personne.email, 'caserne+chef-equipe@exemple.fr'));
		await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		expect(await base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.email, 'caserne+chef-equipe@exemple.fr'))).toEqual([{ prenom: 'Élodie', nom: 'Chef-de-Garde' }]);
	});

	it('refuse une boîte mal écrite', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		for (const boite of ['', 'caserne', 'caserne+chef@exemple.fr', 'a@b@c.fr']) await expect(chargerComptesDeTest(base, base.photos, boite, maintenant)).rejects.toThrow(DonneeInvalide);
	});

	it('se relance un autre jour et complète un chargement interrompu', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		// Interruption simulée : seul le premier compte existe, sans son rôle.
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		await ajouterPersonne(base, { type: 'super', email: 'admin@exemple.fr' }, { email: 'caserne+chef@exemple.fr', prenom: 'Claire', nom: 'Chef', profilId: agent!.id }, aujourdhui, []);
		await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		const avant = (await base.select().from(publication)).length;
		expect((await mursDuCompte(base, 'chef')).length).toBe(8);
		await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', '2026-12-29T10:00');
		expect((await base.select().from(publication)).length).toBe(avant);
	});

	it('marche un 29 février et normalise la boîte', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		await chargerComptesDeTest(base, base.photos, '  Caserne@Exemple.FR ', '2028-02-29T10:00');
		const [agent] = await base.select().from(personne).where(eq(personne.email, 'caserne+agent@exemple.fr'));
		expect(agent?.naissance).toBe('1996-02-29');
	});

	it('cohabite avec d’autres personnes déjà inscrites', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		await ajouterPersonne(base, { type: 'super', email: 'admin@exemple.fr' }, { email: 'alice.martin@exemple.fr', prenom: 'Alice', nom: 'Martin', profilId: agent!.id }, aujourdhui, []);
		await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		expect((await base.select().from(personne)).length).toBe(COMPTES_DE_TEST.length + 1);
	});

	it('n’écrit rien s’il manque une pièce du centre (un comité)', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		await base.update(comite).set({ dissousLe: '2026-01-01' }).where(eq(comite.nom, 'Amicale'));
		await expect(chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant)).rejects.toThrow('comité « Amicale » absent ou dissous');
		expect(await base.select().from(personne)).toEqual([]);
	});

	it('une équipe inactive : saute ses comptes, le dit sans adresse, charge le reste dont l’habillement', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.ordreRotation, 4));
		const infos = await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		expect(infos).toEqual(['Équipe 4 absente ou inactive : compte « habillement » non créé, ni ses données.']);
		const adresses = (await base.select({ email: personne.email }).from(personne)).map((p) => p.email);
		expect(adresses).not.toContain('caserne+habillement@exemple.fr');
		expect(adresses).toHaveLength(COMPTES_DE_TEST.length - 1);
		// Les demandes d'habillement sont là, suivies par le chef de centre (il a le droit de les traiter).
		const [chef] = await base.select().from(personne).where(eq(personne.email, 'caserne+chef@exemple.fr'));
		const demandes = await base.select({ etape: demandeHabillement.etape, prisePar: demandeHabillement.prisePar }).from(demandeHabillement).orderBy(demandeHabillement.id);
		expect(demandes.map((d) => d.etape)).toEqual(['demandee', 'question', 'traitee', 'livree']);
		expect(demandes.filter((d) => d.prisePar !== null).every((d) => d.prisePar === chef!.id)).toBe(true);
		// Relançable, et l'équipe revenue, le compte manquant est créé.
		await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		await base.update(equipe).set({ active: 1 }).where(eq(equipe.ordreRotation, 4));
		expect(await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant)).toEqual([]);
		expect(await acteurDe(base, 'caserne+habillement@exemple.fr', [])).not.toBeNull();
	});

	it('une équipe absente : saute ses comptes et les publications et gestes qui en dépendent', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		await base.delete(equipe).where(eq(equipe.ordreRotation, 1));
		const infos = await chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant);
		expect(infos).toEqual(['Équipe 1 absente ou inactive : comptes « chef-equipe » et « agent » non créés, ni leurs données.']);
		expect(infos.join(' ')).not.toContain('@');
		const pubs = await base.select({ mur: publication.mur, texte: publication.texte }).from(publication);
		expect(pubs.some((p) => p.mur.startsWith('equipe:'))).toBe(false);
		expect(pubs.some((p) => p.mur === 'vie')).toBe(false);
		expect(pubs.filter((p) => p.mur === 'centre')).toHaveLength(3);
		expect(await base.select().from(reservation)).toEqual([]);
		expect(await base.select().from(demandeHabillement)).not.toEqual([]);
	});

	it('refuse une adresse de super administrateur', async () => {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		await expect(chargerComptesDeTest(base, base.photos, 'caserne@exemple.fr', maintenant, ['Caserne+chef@exemple.fr'])).rejects.toThrow(DonneeInvalide);
		expect(await base.select().from(personne)).toEqual([]);
	});

	it('n’inscrit pas l’adresse de la boîte au journal', async () => {
		const base = await jeu();
		const lignes = await base.select().from(journal);
		expect(lignes.some((l) => l.acteur === 'super:comptes-de-test')).toBe(true);
		expect(lignes.some((l) => l.acteur.includes('caserne@'))).toBe(false);
	});
});

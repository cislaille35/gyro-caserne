import { readdirSync, readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { dissoudreComite } from '../src/actions/comites.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { exigerMur, mursDe, type Mur } from '../src/murs.ts';
import { affectationEquipe, attribution, comite, equipe, personne, photoPublication, profil, publication, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-28';
const hier = '2026-10-27';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const responsabilites = await base.select().from(responsabilite);
	const role = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);

	const nouvelle = async (prenom: string, options: { exterieur?: boolean; sansProfil?: boolean; statut?: 'parti' | 'suspendu' } = {}) => {
		const [p] = await base
			.insert(personne)
			.values({
				email: `${prenom.toLowerCase()}@exemple.fr`,
				prenom,
				nom: 'Test',
				profilId: options.sansProfil ? null : profils.find((x) => x.typePersonne === (options.exterieur ? 'exterieur' : 'agent'))!.id,
				statut: options.statut ?? 'operationnel'
			})
			.returning();
		return p!.id;
	};
	const nommer = async (personneId: number, nom: string, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }, fin: string | null = null) => {
		await base.insert(attribution).values({
			personneId,
			responsabiliteId: role(nom),
			perimetreType: perimetre.type,
			perimetreId: perimetre.id ?? null,
			debut: '2026-01-01',
			fin,
			saisiePar: 'super:a@b.fr',
			saisieLe: '2026-01-01'
		});
	};
	const affecter = async (personneId: number, equipeId: number, fin: string | null = null, debut = '2026-01-01') => {
		await base.insert(affectationEquipe).values({ personneId, equipeId, debut, fin });
	};
	return { base, nouvelle, nommer, affecter, amicale: amicale!, e1: equipes[0]!, e2: equipes[1]! };
}

const resume = (murs: Mur[]) => murs.map((m) => `${m.cle} ${m.peutPublier ? 'P' : '-'}${m.peutModerer ? 'M' : '-'}${m.lectureSeule ? 'L' : '-'}`);

describe('mursDe', () => {
	it('agent sans équipe ni comité : lit « Le centre », lit et publie dans « Vie du centre »', async () => {
		const { base, nouvelle } = await jeu();
		const id = await nouvelle('David');
		const murs = await mursDe(base, acteur(id), aujourdhui);
		expect(murs).toEqual([
			{ cle: 'centre', nom: 'Le centre', type: 'centre', peutPublier: false, peutModerer: false, lectureSeule: false },
			{ cle: 'vie', nom: 'Vie du centre', type: 'vie', peutPublier: true, peutModerer: false, lectureSeule: false }
		]);
	});

	it('membre d’une équipe : son mur d’équipe, publier sans modérer', async () => {
		const { base, nouvelle, affecter, e1 } = await jeu();
		const id = await nouvelle('David');
		await affecter(id, e1.id);
		const murs = await mursDe(base, acteur(id), aujourdhui);
		expect(murs[2]).toEqual({ cle: `equipe:${e1.id}`, nom: e1.nom, type: 'equipe', peutPublier: true, peutModerer: false, lectureSeule: false });
		expect(murs).toHaveLength(3);
	});

	it('affectation terminée hier : plus d’accès au mur de l’équipe', async () => {
		const { base, nouvelle, affecter, e1 } = await jeu();
		const id = await nouvelle('David');
		await affecter(id, e1.id, hier);
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
		await expect(exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('chef d’équipe : lit, publie et modère le mur de son équipe, même sans y être affecté', async () => {
		const { base, nouvelle, nommer, e2 } = await jeu();
		const id = await nouvelle('Alice');
		await nommer(id, 'Chef d’équipe', { type: 'equipe', id: e2.id });
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--', `equipe:${e2.id} PM-`]);
	});

	it('membre et rapporteur de comité : publier pour le membre, modérer pour le rapporteur', async () => {
		const { base, nouvelle, nommer, amicale } = await jeu();
		const membre = await nouvelle('Bruno');
		const rapporteur = await nouvelle('Chloé');
		await nommer(membre, 'Membre de comité', { type: 'comite', id: amicale.id });
		await nommer(rapporteur, 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		expect((await mursDe(base, acteur(membre), aujourdhui))[2]).toEqual({ cle: `comite:${amicale.id}`, nom: 'Amicale', type: 'comite', peutPublier: true, peutModerer: false, lectureSeule: false });
		expect(resume(await mursDe(base, acteur(rapporteur), aujourdhui))[2]).toBe(`comite:${amicale.id} PM-`);
	});

	it('attribution de comité terminée hier : plus d’accès', async () => {
		const { base, nouvelle, nommer, amicale } = await jeu();
		const id = await nouvelle('Bruno');
		await nommer(id, 'Membre de comité', { type: 'comite', id: amicale.id }, hier);
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
	});

	it('chef de centre et adjoint : tous les murs, publier et modérer partout', async () => {
		const { base, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire');
		const adjoint = await nouvelle('Hugo');
		await nommer(chef, 'Chef de centre', { type: 'centre' });
		await nommer(adjoint, 'Chef de centre adjoint', { type: 'centre' });
		const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
		const comites = await base.select().from(comite).orderBy(comite.nom);
		const attendu = ['centre PM-', 'vie PM-', ...equipes.map((e) => `equipe:${e.id} PM-`), ...comites.map((c) => `comite:${c.id} PM-`)];
		for (const id of [chef, adjoint]) expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(attendu);
	});

	it('super administrateur : tous les murs ; équipe inactive et comité dissous en lecture seule, à la fin', async () => {
		const { base, amicale, e1 } = await jeu();
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		const murs = resume(await mursDe(base, superAdmin, aujourdhui));
		expect(murs.slice(0, 2)).toEqual(['centre PM-', 'vie PM-']);
		expect(murs.filter((m) => m.endsWith('L'))).toEqual([`equipe:${e1.id} -ML`, `comite:${amicale.id} -ML`]);
		const derniereEquipeActive = murs.findLastIndex((m) => m.startsWith('equipe:') && !m.endsWith('L'));
		expect(murs.indexOf(`equipe:${e1.id} -ML`)).toBeGreaterThan(derniereEquipeActive);
		expect(murs.at(-1)).toBe(`comite:${amicale.id} -ML`);
	});

	it('membre d’une équipe inactive : lecture seule, publier refusé', async () => {
		const { base, nouvelle, affecter, e1 } = await jeu();
		const id = await nouvelle('David');
		await affecter(id, e1.id);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--', `equipe:${e1.id} --L`]);
		expect((await exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'lire')).nom).toBe(e1.nom);
		await expect(exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('chef d’une équipe inactive : lit et modère, ne publie pas', async () => {
		const { base, nouvelle, nommer, e1 } = await jeu();
		const id = await nouvelle('Alice');
		await nommer(id, 'Chef d’équipe', { type: 'equipe', id: e1.id });
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		expect(resume(await mursDe(base, acteur(id), aujourdhui))[2]).toBe(`equipe:${e1.id} -ML`);
		expect((await exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'moderer')).peutModerer).toBe(true);
		await expect(exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('comité dissous : archive en lecture seule pour le chef, l’adjoint et le super ; les anciens membres et rapporteur n’y ont plus accès', async () => {
		const { base, nouvelle, nommer, amicale } = await jeu();
		const membre = await nouvelle('Bruno');
		const rapporteur = await nouvelle('Chloé');
		const chef = await nouvelle('Claire');
		const adjoint = await nouvelle('Hugo');
		await nommer(membre, 'Membre de comité', { type: 'comite', id: amicale.id });
		await nommer(rapporteur, 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await nommer(chef, 'Chef de centre', { type: 'centre' });
		await nommer(adjoint, 'Chef de centre adjoint', { type: 'centre' });
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		const cle = `comite:${amicale.id}`;
		for (const id of [membre, rapporteur]) {
			expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
			await expect(exigerMur(base, acteur(id), cle, aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
		}
		for (const qui of [acteur(chef), acteur(adjoint), superAdmin]) {
			expect(await exigerMur(base, qui, cle, aujourdhui, 'moderer')).toMatchObject({ lectureSeule: true, peutPublier: false, peutModerer: true });
			await expect(exigerMur(base, qui, cle, aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
		}
	});

	it('comité dissous, attribution restée ouverte : pas d’accès pour le membre', async () => {
		const { base, nouvelle, nommer, amicale } = await jeu();
		const id = await nouvelle('Bruno');
		await nommer(id, 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await base.update(comite).set({ dissousLe: '2026-10-01' }).where(eq(comite.id, amicale.id));
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
	});

	it('bornes : affectation finie aujourd’hui garde l’accès, affectation qui commence demain n’en donne pas', async () => {
		const { base, nouvelle, affecter, e1, e2 } = await jeu();
		const id = await nouvelle('David');
		await affecter(id, e1.id, aujourdhui);
		await affecter(id, e2.id, null, '2026-10-29');
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--', `equipe:${e1.id} P--`]);
	});

	it('personne sans profil : comptée comme agent', async () => {
		const { base, nouvelle } = await jeu();
		const id = await nouvelle('Nina', { sansProfil: true });
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
	});

	it('extérieur, parti, suspendu : aucun mur', async () => {
		const { base, nouvelle, nommer, affecter, amicale, e1 } = await jeu();
		const exterieur = await nouvelle('Eva', { exterieur: true });
		const parti = await nouvelle('Paul', { statut: 'parti' });
		const suspendu = await nouvelle('Sam', { statut: 'suspendu' });
		for (const id of [exterieur, parti, suspendu]) {
			await affecter(id, e1.id);
			await nommer(id, 'Membre de comité', { type: 'comite', id: amicale.id });
		}
		await nommer(suspendu, 'Chef de centre', { type: 'centre' });
		for (const id of [exterieur, parti, suspendu]) {
			expect(await mursDe(base, acteur(id), aujourdhui)).toEqual([]);
			await expect(exigerMur(base, acteur(id), 'centre', aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
		}
	});

	it('chef de centre : au plus 10 requêtes', async () => {
		const { base, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire');
		await nommer(chef, 'Chef de centre', { type: 'centre' });
		base.requetes = 0;
		await mursDe(base, acteur(chef), aujourdhui);
		expect(base.requetes).toBeLessThanOrEqual(10);
	});
});

describe('exigerMur', () => {
	it('rend le mur selon le besoin, refuse sinon', async () => {
		const { base, nouvelle } = await jeu();
		const id = await nouvelle('David');
		expect((await exigerMur(base, acteur(id), 'centre', aujourdhui, 'lire')).nom).toBe('Le centre');
		await expect(exigerMur(base, acteur(id), 'centre', aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
		expect((await exigerMur(base, acteur(id), 'vie', aujourdhui, 'publier')).cle).toBe('vie');
		await expect(exigerMur(base, acteur(id), 'vie', aujourdhui, 'moderer')).rejects.toBeInstanceOf(RefusDroit);
		expect((await exigerMur(base, superAdmin, 'vie', aujourdhui, 'moderer')).peutModerer).toBe(true);
	});

	it('clé mal formée : « Mur inconnu »', async () => {
		const { base } = await jeu();
		for (const cle of ['equipe:abc', 'equipe:', 'salon', 'comite:01', 'equipe:1:2', 'equipe:007', 'equipe:1.5', 'comite:-1']) {
			await expect(exigerMur(base, superAdmin, cle, aujourdhui, 'lire')).rejects.toThrow(new DonneeInvalide('Mur inconnu'));
		}
	});

	it('équipe qui n’existe pas : refusé', async () => {
		const { base } = await jeu();
		await expect(exigerMur(base, superAdmin, 'equipe:999', aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('tables des murs', () => {
	it('supprimer une publication supprime ses photos ; une photo se relit en Uint8Array', async () => {
		const { base } = await jeu();
		const [p] = await base.insert(publication).values({ mur: 'centre', auteur: 'super:a@b.fr', type: 'message', texte: 'Bonjour', creeLe: '2026-10-28T08:00:00Z' }).returning();
		await base.insert(photoPublication).values({ publicationId: p!.id, ordre: 1, type: 'image/jpeg', donnees: new Uint8Array([1, 2, 3]) });
		const [photo] = await base.select().from(photoPublication);
		expect(photo!.donnees).toBeInstanceOf(Uint8Array);
		expect([...photo!.donnees]).toEqual([1, 2, 3]);
		await base.delete(publication).where(eq(publication.id, p!.id));
		expect(await base.select().from(photoPublication)).toEqual([]);
	});

	it('migration des murs : seulement des CREATE TABLE et CREATE INDEX', () => {
		const dossier = new URL('../migrations/', import.meta.url);
		const fichier = readdirSync(dossier).find((f) => f.startsWith('0003_') && f.endsWith('.sql'));
		expect(fichier).toBeDefined();
		const instructions = readFileSync(new URL(fichier!, dossier), 'utf8')
			.split('--> statement-breakpoint')
			.map((i) => i.replace(/^\s*--.*$/gm, '').trim())
			.filter(Boolean);
		expect(instructions.length).toBeGreaterThan(0);
		expect(instructions.every((i) => /^CREATE (UNIQUE )?(TABLE|INDEX) /.test(i))).toBe(true);
	});
});

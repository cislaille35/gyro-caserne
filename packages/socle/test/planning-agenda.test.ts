import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { agendaDe, changerLienAgenda, egaux, monLienAgenda, versUtc } from '../src/planning/agenda.ts';
import { enregistrerManoeuvre, publierAnnee, reglerRoulement, supprimerManoeuvre } from '../src/planning/annee.ts';
import { affectationEquipe, attribution, cleAgenda, equipe, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-01T10:00';

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const [c] = await base.insert(personne).values({ email: 'chef@exemple.fr', prenom: 'Chef', nom: 'T', profilId: agent!.id }).returning();
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: c!.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const [a] = await base.insert(personne).values({ email: 'alice@exemple.fr', prenom: 'Alice', nom: 'T', profilId: agent!.id }).returning();
	await base.insert(affectationEquipe).values({ personneId: a!.id, equipeId: ids[0]!, debut: '2026-01-01' });
	const chef = { type: 'personne' as const, id: c!.id };
	const alice = { type: 'personne' as const, id: a!.id };
	await reglerRoulement(base, chef, 2026, ids, maintenant);
	await publierAnnee(base, chef, 2026, maintenant);
	return { base, ids, chef, alice };
}

describe('heure de Paris vers UTC', () => {
	it('suit l’heure d’été et d’hiver', () => {
		expect(versUtc('2026-11-06T18:00')).toBe('20261106T170000Z');
		expect(versUtc('2026-07-03T18:00')).toBe('20260703T160000Z');
		// Nuit du changement d'heure (25 octobre 2026, 3 h → 2 h)
		expect(versUtc('2026-10-26T06:00')).toBe('20261026T050000Z');
		expect(versUtc('2026-10-24T18:00')).toBe('20261024T160000Z');
	});
});

describe('comparaison en temps constant', () => {
	it('dit égal seulement pour deux textes identiques', () => {
		expect(egaux('abc', 'abc')).toBe(true);
		expect(egaux('abc', 'abd')).toBe(false);
		expect(egaux('abc', 'ab')).toBe(false);
	});
});

describe('agenda de l’agent', () => {
	it('un lien stable, secret, que « Changer le lien » remplace', async () => {
		const { base, alice } = await jeu();
		const lien = await monLienAgenda(base, alice, maintenant);
		expect(lien).toMatch(new RegExp(`^${alice.id}-[A-Za-z0-9_-]{43}$`));
		expect(await monLienAgenda(base, alice, maintenant)).toBe(lien);
		const nouveau = await changerLienAgenda(base, alice, maintenant);
		expect(nouveau).not.toBe(lien);
		expect(await agendaDe(base, lien, maintenant, reglage)).toBeNull();
		expect(await agendaDe(base, nouveau, maintenant, reglage)).toContain('BEGIN:VCALENDAR');
	});

	it('refuse une clé fausse, un format inconnu, un agent parti', async () => {
		const { base, alice, chef } = await jeu();
		const lien = await monLienAgenda(base, alice, maintenant);
		expect(await agendaDe(base, `${alice.id}-${'A'.repeat(43)}`, maintenant, reglage)).toBeNull();
		expect(await agendaDe(base, `${chef.id}-${lien.split('-').slice(1).join('-')}`, maintenant, reglage)).toBeNull();
		expect(await agendaDe(base, 'n-importe-quoi', maintenant, reglage)).toBeNull();
		await changerStatut(base, base.photos, { type: 'super', email: 'a@b.fr' }, alice.id, 'parti', maintenant);
		expect(await agendaDe(base, lien, maintenant, reglage)).toBeNull();
		expect(await base.select().from(cleAgenda)).toHaveLength(0);
	});

	it('ses astreintes aux vraies heures, ses manœuvres, ses gardes de fête', async () => {
		const { base, alice, chef, ids } = await jeu();
		await enregistrerManoeuvre(base, chef, { debut: '2026-11-15T08:30', theme: 'Sport, SAP', lieu: 'Caserne', convoques: [ids[0]!], petitDejeuner: true }, maintenant);
		const autre = await enregistrerManoeuvre(base, chef, { debut: '2026-11-22T08:30', theme: 'Autre équipe', lieu: 'Caserne', convoques: [ids[1]!], petitDejeuner: false }, maintenant);
		const texte = (await agendaDe(base, await monLienAgenda(base, alice, maintenant), maintenant, reglage))!;
		expect(texte).toContain('\r\n');
		// Semaine du 6 novembre (index 44, équipe 1) : vendredi 18 h → lundi 6 h d'un seul tenant
		expect(texte).toContain('DTSTART:20261106T170000Z\r\nDTEND:20261109T050000Z\r\nSUMMARY:Astreinte · Équipe 1');
		expect(texte).toContain('SUMMARY:Manœuvre : Sport\\, SAP');
		expect(texte).toContain('LOCATION:Caserne');
		expect(texte).not.toContain('Autre équipe');
		expect(texte.split('BEGIN:VEVENT').length - 1).toBeGreaterThan(50);
		expect(texte.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
		await supprimerManoeuvre(base, chef, autre, maintenant);
	});

	it('une année non publiée n’y figure pas', async () => {
		const { base, alice, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2027, ids, maintenant);
		const texte = (await agendaDe(base, await monLienAgenda(base, alice, maintenant), maintenant, reglage))!;
		expect(texte).not.toContain('DTSTART:2027');
	});

	it('seulement l’an dernier, cette année et l’an prochain', async () => {
		const { base, alice, chef, ids } = await jeu();
		await reglerRoulement(base, chef, 2029, ids, maintenant);
		await publierAnnee(base, chef, 2029, maintenant);
		expect(await agendaDe(base, await monLienAgenda(base, alice, maintenant), maintenant, reglage)).not.toContain('DTSTART:2029');
	});

	it('un thème ne peut pas ajouter de ligne au fichier', async () => {
		const { base, alice, chef, ids } = await jeu();
		await enregistrerManoeuvre(base, chef, { debut: '2026-11-15T08:30', theme: 'A\rEND:VEVENT\nB', lieu: 'Caserne', convoques: [ids[0]!], petitDejeuner: false }, maintenant);
		const texte = (await agendaDe(base, await monLienAgenda(base, alice, maintenant), maintenant, reglage))!;
		expect(texte).toContain('SUMMARY:Manœuvre : A\\nEND:VEVENT\\nB');
		expect(texte.split('\r\n').filter((l) => l === 'END:VEVENT')).toHaveLength(texte.split('BEGIN:VEVENT').length - 1);
	});

	it('un agent suspendu : 404, sa clé est gardée', async () => {
		const { base, alice } = await jeu();
		const lien = await monLienAgenda(base, alice, maintenant);
		await base.update(personne).set({ statut: 'suspendu' }).where(eq(personne.id, alice.id));
		expect(await agendaDe(base, lien, maintenant, reglage)).toBeNull();
		expect(await base.select().from(cleAgenda)).toHaveLength(1);
	});
});


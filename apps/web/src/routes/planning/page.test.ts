import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { calculerAnnee, feries } from '@gyro-caserne/socle';
import Page from './+page.svelte';

const equipes = [
	{ id: 1, nom: 'Équipe 1', couleur: '#d4a017' },
	{ id: 2, nom: 'Équipe 2', couleur: '#c2185b' },
	{ id: 3, nom: 'Équipe 3', couleur: '#1565c0' },
	{ id: 4, nom: 'Équipe 4', couleur: '#2e7d32' }
];
const semaines = calculerAnnee(2026, centre.astreinte, [1, 2, 3, 4], new Map()).map((s) => ({ ...s, mienne: s.equipeId === 1 }));
const sem = (debut: string) => semaines.find((s) => s.debut === debut)!;
const manoeuvre = { id: 1, debut: '2026-11-15T08:30', theme: 'Sport + SAP', lieu: 'Caserne', convoques: [1], convocation: [1], petitDejeuner: true, annulee: false, publiee: true, publicationId: 42 };
const publiee = {
	publiee: true,
	annee: 2026,
	peutPreparer: false,
	equipes,
	semaines,
	manoeuvres: [{ ...manoeuvre, convoque: true }],
	vacances: [{ id: 1, nom: 'Vacances de Noël', debut: '2026-12-19', fin: '2027-01-04' }],
	feries: feries(2026),
	fetes: { noel: 3, nouvelAn: 4 },
	monEquipe: 1,
	remplacements: [{ debut: '2026-11-09T18:00', fin: '2026-11-10T06:00', titulaire: 'Alice Martin', remplacant: 'Bruno Petit', moi: null }],
	prochaine: { astreinte: { debut: '2026-11-06T18:00', fin: '2026-11-13T06:00', equipeId: 1, enCours: false, periodes: sem('2026-11-06').periodes }, manoeuvre: { ...manoeuvre, reponse: 'present' }, fete: null }
};
const vides = { miennes: [], pourMoi: [], aValider: [] };
const page = (data: Record<string, unknown>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { maintenant: '2026-11-01T10:00', vue: 'semaine', vueDemandee: false, semaine: '2026-11-06', mois: 11, moisCourant: 11, remplacements: vides, planning: publiee, ...data }, form: null } }).body;

describe('onglet Planning', () => {
	it('non publié : la phrase et un vide soigné ; « Préparer l’année » pour le chef seulement', () => {
		const html = page({ planning: { publiee: false, annee: 2027, peutPreparer: false } });
		expect(html).toContain('Le planning 2027 n’est pas encore publié.');
		expect(html).not.toContain('Préparer l’année');
		expect(page({ planning: { publiee: false, annee: 2026, peutPreparer: true } })).toContain('href="/planning/preparer?annee=2026"');
	});

	it('en-tête vivant et carte : compte à rebours, dates, équipe écrite, gestes', () => {
		const html = page({});
		expect(html).toMatch(/<h1[^>]*>Planning<\/h1>/);
		expect(html).toContain('Votre équipe est d’astreinte dans 5 jours.');
		expect(html).toContain('Ma prochaine astreinte');
		expect(html).toContain('Du ven. 6 nov. 18 h au ven. 13 nov. 6 h');
		expect(html).toContain('href="/remplacements/demander#periode-2026-11-06"');
		expect(html).toContain('Ajouter à mon agenda');
	});

	it('sans équipe : la carte de la semaine en cours, la vue des équipes', () => {
		const sansEquipe = { ...publiee, monEquipe: null, semaines: semaines.map((s) => ({ ...s, mienne: false })), prochaine: { ...publiee.prochaine, astreinte: null } };
		const html = page({ planning: sansEquipe, vue: 'equipes' });
		expect(html).toContain('Cette semaine : Équipe 4 d’astreinte');
		expect(html).not.toContain('Mon astreinte');
		expect(html).not.toContain('Me faire remplacer<');
	});

	it('À venir : la manœuvre avec ma réponse sur place, les remplacements', () => {
		const demande = { id: 7, genre: 'remplacement', etat: 'attente', demandeur: { id: 2, prenom: 'Bruno', nom: 'Petit' }, cible: null, remplacant: null, texte: 'nuit du lundi 9 novembre', moi: 'destinataire', gestes: {} };
		const html = page({ remplacements: { ...vides, pourMoi: [demande] } });
		expect(html).toMatch(/<h2[^>]*>À venir/);
		expect(html).toContain('Sport + SAP');
		expect(html).toMatch(/action="\?\/repondre&amp;annee=2026"/);
		expect(html).toMatch(/<button[^>]*value="present"[^>]*aria-pressed="true"/);
		expect(html).toMatch(/<button[^>]*value="absent"[^>]*aria-pressed="false"/);
		expect(html).toContain('href="/remplacements/7"');
		expect(html).toContain('Bruno Petit cherche un remplaçant');
		expect(html).toContain('href="/remplacements"');
	});

	it('les quatre vues en puces, la choisie marquée', () => {
		const html = page({});
		for (const [vue, libelle] of [
			['semaine', 'Semaine'],
			['mois', 'Mois'],
			['annee', 'Année'],
			['equipes', 'Équipes']
		])
			expect(html).toMatch(new RegExp(`href="\\?annee=2026&amp;vue=${vue}"[^>]*>${libelle}<`));
		expect(html).toMatch(/href="\?annee=2026&amp;vue=semaine"[^>]*aria-current="page"/);
	});

	it('Semaine : jour par jour, les plages, « X remplace Y », les flèches', () => {
		const html = page({});
		expect(html).toMatch(/<h2[^>]*>Semaine 45/);
		expect(html).toContain('Mon astreinte');
		expect(html).toContain('Vendredi 6 novembre');
		expect(html).toContain('dès 18 h');
		expect(html).toContain('Bruno Petit remplace Alice Martin');
		expect(html).toContain('Armistice 1918');
		expect(html).toContain('href="?annee=2026&amp;vue=semaine&amp;semaine=2026-10-30"');
		expect(html).toContain('href="?annee=2026&amp;vue=semaine&amp;semaine=2026-11-13"');
	});

	it('Semaine : la première de l’année renvoie à la dernière de l’année d’avant', () => {
		expect(page({ semaine: '2026-01-02' })).toContain('href="?annee=2025&amp;vue=semaine&amp;semaine=derniere"');
	});

	it('Mois : une bande par semaine, numéro et équipe écrits ; un jour mène à sa semaine', () => {
		const html = page({ vue: 'mois' });
		expect(html).toMatch(/<h2[^>]*>Novembre 2026/);
		expect(html).toMatch(/<th scope="row"[^>]*>[\s\S]*?S45[\s\S]*?Équipe 1[\s\S]*?Mon astreinte/);
		expect(html).toContain('href="?annee=2026&amp;vue=semaine&amp;semaine=2026-11-06#jour-2026-11-11"');
		expect(html).toMatch(/Férié\u00a0:<\/span> Armistice 1918/);
		expect(html).toContain('href="?annee=2026&amp;vue=mois&amp;mois=12"');
		expect(page({ vue: 'mois', mois: 12 })).toContain('href="?annee=2027&amp;vue=mois&amp;mois=1"');
	});

	it('Année : douze mois repliés sauf le mois en cours, chacun résumé', () => {
		const html = page({ vue: 'annee' });
		expect((html.match(/<details/g) ?? []).length).toBe(12);
		expect((html.match(/<details[^>]*open/g) ?? []).length).toBe(1);
		expect(html).toMatch(/<details[^>]*open[^>]*><summary[^>]*><h3[^>]*>Novembre<\/h3><span class="resume[^"]*">1 astreinte · 1 manœuvre · 2 fériés/);
		expect(html).toContain('Seulement mes semaines');
		expect((html.match(/Mon astreinte/g) ?? []).length).toBeGreaterThanOrEqual(semaines.filter((s) => s.mienne).length);
	});

	it('Équipes : chaque semaine nomme son équipe, sans « Mon astreinte » dans la liste', () => {
		const html = page({ vue: 'equipes' });
		expect(html).toContain('Les équipes en 2026');
		expect(html).not.toContain('Seulement mes semaines');
		expect((html.match(/<span class="equipe[^"]*">Équipe 4<\/span>/g) ?? []).length).toBe(13);
	});
});

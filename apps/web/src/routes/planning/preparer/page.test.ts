import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import centre from '$centre';
import { calculerAnnee, feries } from '@gyro-caserne/socle';
import Page from './+page.svelte';

const equipes = [1, 2, 3, 4].map((id) => ({ id, nom: `Équipe ${id}`, couleur: '#d4a017' }));
const semaines = calculerAnnee(2027, centre.astreinte, [1, 2, 3, 4], new Map());
const preparation = (autres: Record<string, unknown> = {}) => ({
	annee: 2027,
	publiee: null,
	ordre: [1, 2, 3, 4],
	ordrePropose: [1, 2, 3, 4],
	semaines,
	manoeuvres: [{ id: 5, debut: '2027-03-07T08:30', theme: 'Feux de forêt', lieu: 'Caserne', convoques: [1, 2], convocation: [1, 2], petitDejeuner: true, annulee: false, publiee: true, publicationId: 9 }],
	vacances: [{ id: 3, nom: 'Vacances d’hiver', debut: '2027-02-13', fin: '2027-03-01' }],
	feries: feries(2027),
	// Noël 2027 : semaine du 24 décembre, Équipe 4.
	fetes: { noel: 4, nouvelAn: 1, attendues: { noel: [2], nouvelAn: [1, 3] }, historique: [{ annee: 2026, fete: 'noel', equipeId: 1 }] },
	equipes,
	...autres
});
const page = (data: Record<string, unknown> = {}, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { preparation: preparation(), annees: [2026, 2027], etape: 'roulement', apercu: semaines.slice(0, 6), manoeuvre: null, semaine: null, semaineTouche: null, proposer: null, ...data }, form } }).body;

describe('Préparer l’année en cinq étapes', () => {
	it('la progression et l’étiquette Brouillon / Publiée à chaque étape', () => {
		for (const etape of ['roulement', 'fetes', 'manoeuvres', 'reperes', 'publier']) {
			const html = page({ etape });
			expect(html).toContain('Brouillon');
			expect(html).toMatch(new RegExp(`href="\\?annee=2027&amp;etape=${etape}"[^>]*aria-current="step"`));
		}
		expect(page({ etape: 'fetes' })).toContain('Étape 2 sur 5');
		expect(page({ preparation: preparation({ publiee: '2026-11-01T10:00' }) })).toContain('Publiée');
	});

	it('Roulement : monter et descendre au clavier, sans liste déroulante ; l’aperçu des premières semaines', () => {
		const html = page();
		expect(html).toMatch(/<button[^>]*name="deplacer"[^>]*value="1:monter"[^>]*aria-label="Monter Équipe 2"/);
		expect(html).toMatch(/<button[^>]*value="0:monter"[^>]*disabled/);
		expect(html).not.toContain('<select');
		expect(html).toContain('Aperçu');
		expect((html.match(/class="numero-s[^"]*">S\d+/g) ?? []).length).toBe(6);
		expect(html).not.toContain('Valider ce roulement');
		expect(page({ preparation: preparation({ ordre: [] }) })).toContain('Valider ce roulement');
	});

	it('Fêtes : hors de son tour, l’échange proposé à accepter', () => {
		const html = page({ etape: 'fetes' });
		expect(html).toContain('Hors de son tour : c’est à Équipe 2 de tenir Noël.');
		expect(html).toContain('href="?annee=2027&amp;etape=fetes&amp;proposer=noel#proposition-noel"');
		expect(html).toContain('Noël 2026');
		const propose = page({ etape: 'fetes', proposer: 'noel' });
		expect(propose).toContain('Accepter l’échange');
		expect(propose).toMatch(/name="semaine-2027-12-24" value="2"/);
		expect(propose).toMatch(/name="semaine-2027-12-10" value="4"/);
	});

	it('Manœuvres : des rangées ; ajout et modification dans un panneau', () => {
		const html = page({ etape: 'manoeuvres' });
		expect(html).toContain('href="?annee=2027&amp;etape=manoeuvres&amp;manoeuvre=5"');
		expect(html).toContain('Ajouter une manœuvre');
		expect(html).not.toContain('class="panneau');
		const panneau = page({ etape: 'manoeuvres', manoeuvre: 5 });
		// Une vraie fenêtre : ouverte sans JavaScript, modale avec ; fermer garde le focus pour le rendre à l'ouvreur.
		expect(panneau).toMatch(/<dialog class="panneau[^"]*" open="" aria-labelledby="[^"]+"/);
		expect(panneau).toMatch(/<a class="fermer[^"]*" href="\?annee=2027&amp;etape=manoeuvres"[^>]*data-sveltekit-reset="false"/);
		expect(panneau).toContain('Modifier la manœuvre');
		expect(panneau).toContain('action="/planning/preparer/manoeuvre?/enregistrer"');
		expect(panneau).toContain('value="Feux de forêt"');
		expect(page({ etape: 'manoeuvres', manoeuvre: 'nouvelle' })).toContain('Ajouter la manœuvre');
	});

	it('Repères : fériés repliés, vacances en rangées et ajout', () => {
		const html = page({ etape: 'reperes' });
		expect(html).toMatch(/<details[^>]*>\s*<summary[^>]*>Jours fériés/);
		expect(html).not.toMatch(/<details[^>]*open/);
		expect(html).toContain('Vacances d’hiver');
		expect(html).toContain('action="?/vacances&amp;annee=2027&amp;etape=reperes"');
	});

	it('Vérifier et publier : la grille des semaines, l’équipe écrite ; une semaine ouvre le choix d’équipe', () => {
		const html = page({ etape: 'publier' });
		expect(html).not.toContain('<select');
		expect(html).toContain('href="?annee=2027&amp;etape=publier&amp;semaine=2027-01-01"');
		expect((html.match(/class="nom[^"]*">Équipe 4</g) ?? []).length).toBe(13);
		expect(html).toContain('Récapitulatif');
		expect(html).toContain('Publier l’année 2027');
		const choix = page({ etape: 'publier', semaine: '2027-01-01' });
		expect(choix).toMatch(/<dialog class="panneau[^"]*"/);
		expect(choix).toMatch(/<button[^>]*name="semaine-2027-01-01"[^>]*value="1"[^>]*aria-pressed="true"/);
		expect(choix).toMatch(/<button[^>]*name="semaine-2027-01-01"[^>]*value="3"[^>]*aria-pressed="false"/);
	});

	it('sans roulement, les étapes qui en dépendent le disent', () => {
		expect(page({ etape: 'publier', preparation: preparation({ ordre: [], semaines: [] }) })).toContain('Réglez d’abord le roulement');
	});

	it('le message d’erreur va au bon formulaire', () => {
		expect(page({}, { cible: 'roulement', message: 'Mettez chaque équipe une fois.' })).toContain('Mettez chaque équipe une fois.');
	});

	it('année publiée : le roulement ne se déplace plus, l’étape 5 change une semaine', () => {
		const html = page({ preparation: preparation({ publiee: '2026-11-01T10:00' }) });
		expect(html).not.toContain('name="deplacer"');
		expect(html).toContain('Année publiée : le roulement ne change plus.');
	});

	it('année publiée : avant de changer une semaine, les remplacements touchés et qui sera prévenu ; commencée, elle ne change plus', () => {
		const publiee = preparation({ publiee: '2026-11-01T10:00' });
		const touche = { commencee: false, remplacements: [{ texte: 'Nuit du lundi 4 janvier : Fred Test remplacé par Hugo Test', conclu: true }, { texte: 'Nuit du mardi 5 janvier : Fred Test cherche un remplaçant', conclu: false }] };
		const html = page({ etape: 'publier', preparation: publiee, semaine: '2027-01-01', semaineTouche: touche });
		expect(html).toContain('2 remplacements touchés');
		expect(html).toContain('Nuit du lundi 4 janvier : Fred Test remplacé par Hugo Test');
		expect(html).toContain('(en cours)');
		expect(html).toContain('Les agents des deux équipes et les personnes de ces remplacements seront prévenus.');
		expect(html.indexOf('remplacements touchés')).toBeLessThan(html.indexOf('name="semaine-2027-01-01"'));
		const commencee = page({ etape: 'publier', preparation: publiee, semaine: '2027-01-01', semaineTouche: { commencee: true, remplacements: [] } });
		expect(commencee).toContain('Semaine commencée : son équipe ne change plus.');
		expect(commencee).not.toContain('name="semaine-2027-01-01"');
	});
});

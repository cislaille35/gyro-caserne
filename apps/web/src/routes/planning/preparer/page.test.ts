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

	const proposition = {
		annee: 2027,
		precedente: true,
		ordre: [1, 2, 3, 4],
		semaines: 53,
		changees: [{ debut: '2027-12-10', numero: 49, avant: 2, apres: 4 }, { debut: '2027-12-24', numero: 51, avant: 4, apres: 2 }],
		fetes: { noel: { equipeId: 2, dansLeTour: true, attendues: [2] }, nouvelAn: { equipeId: 1, dansLeTour: true, attendues: [1] }, compromis: false, memeSemaine: false, deSuite: [] },
		manoeuvres: [{ debut: '2027-03-14T08:30', theme: 'Feux de forêt', lieu: 'Stade', convoques: [1, 2], petitDejeuner: true }],
		tourDeRole: true,
		annulees: 1,
		passees: 0,
		deja: 0,
		vacances: 0,
		equipes: [{ id: 1, nom: 'Équipe 1', couleur: '#d4a017', effectif: 6, arme: true, manque: [] }, { id: 3, nom: 'Équipe 3', couleur: '#d4a017', effectif: 6, arme: false, manque: ['ce'] }]
	};

	it('une année sans roulement : le bouton « Partir d’une proposition », à chaque étape ; pas une fois préparée', () => {
		const vide = preparation({ ordre: [], semaines: [], manoeuvres: [] });
		for (const etape of ['roulement', 'fetes', 'manoeuvres', 'reperes', 'publier']) {
			expect(page({ etape, preparation: vide })).toMatch(new RegExp(`href="\\?annee=2027&amp;etape=${etape}&amp;proposition=1"[^>]*>Partir d’une proposition`));
		}
		expect(page()).not.toContain('Partir d’une proposition');
		expect(page({ preparation: preparation({ ordre: [], semaines: [], ordrePropose: [] }) })).not.toContain('Partir d’une proposition');
	});

	it('le panneau : l’état des équipes en tête, signalé seulement, puis le résumé et « Accepter »', () => {
		const html = page({ preparation: preparation({ ordre: [], semaines: [] }), proposition });
		expect(html).toContain('Proposition pour 2027');
		expect(html).toContain('Équipe 3 : 6 agents, il manque 1 CE');
		expect(html).toContain('Équipe 1 : 6 agents, peut armer le FPT seule');
		expect(html).toContain('href="/agents"');
		expect(html).toContain('href="/nominations"');
		expect(html).toContain('53 semaines · Noël : Équipe 2 · Nouvel An : Équipe 1 · 1 manœuvre reprise · Équipe 3 incomplète · Aucune période de vacances saisie');
		expect(html).toContain('action="?/proposition&amp;annee=2027&amp;etape=roulement"');
		expect(html).toContain('Accepter et écrire le brouillon');
		expect(html.indexOf('il manque 1 CE')).toBeLessThan(html.indexOf('Feux de forêt'));
		expect(html.indexOf('Feux de forêt')).toBeLessThan(html.indexOf('Accepter et écrire le brouillon'));
	});

	it('le panneau : semaines changées, manœuvres, tour de rôle, annulées écartées', () => {
		const html = page({ preparation: preparation({ ordre: [], semaines: [] }), proposition });
		expect(html).toContain('2 semaines changées');
		expect(html).toContain('S51');
		expect(html).toContain('Le tour de rôle continue');
		expect(html).toContain('1 annulée non reprise');
		expect(html).toContain('Équipe 1, Équipe 2');
	});

	it('le panneau : sans année précédente, le roulement de base ; un compromis dit clairement', () => {
		const sans = { ...proposition, precedente: false, changees: [], manoeuvres: [], tourDeRole: false, annulees: 0 };
		const html = page({ preparation: preparation({ ordre: [], semaines: [] }), proposition: sans });
		expect(html).toContain('2026 n’a pas de planning');
		expect(html).toContain('Aucune semaine à changer');
		expect(html).toContain('Aucune manœuvre à reprendre');
		const compromis = { ...proposition, fetes: { noel: { equipeId: 2, dansLeTour: true, attendues: [2] }, nouvelAn: { equipeId: 1, dansLeTour: false, attendues: [2] }, compromis: true, memeSemaine: false, deSuite: [1] } };
		const dur = page({ preparation: preparation({ ordre: [], semaines: [] }), proposition: compromis });
		expect(dur).toContain('Impossible de respecter le tour des deux fêtes');
		expect(dur).toContain('Équipe 1 tient deux semaines de suite');
	});

	it('le panneau : personne d’astreinte à une fête, pas de mention du tour', () => {
		const sans = { ...proposition, fetes: { ...proposition.fetes, nouvelAn: { equipeId: null, dansLeTour: true, attendues: [] } } };
		const html = page({ preparation: preparation({ ordre: [], semaines: [] }), proposition: sans });
		expect(html).toContain('<strong>Nouvel An</strong> : personne');
		expect((html.match(/dans son tour/g) ?? []).length).toBe(1);
	});

	it('après l’acceptation ou un refus, le message reste visible hors du panneau', () => {
		expect(page({}, { cible: 'proposition', succes: 'Brouillon écrit.' })).toContain('Brouillon écrit.');
		expect(page({}, { cible: 'proposition', message: 'Cette année a déjà un roulement' })).toContain('Cette année a déjà un roulement');
	});
});

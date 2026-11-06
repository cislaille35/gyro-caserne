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
		expect(html).toContain('href="/remplacements/demander?semaine=2026-11-06"');
		expect(html).toContain('Ajouter à mon agenda');
	});

	it('semaine d’été : son groupe à la place de l’équipe, dans les vues et la carte ; le reste de l’année ne change pas', () => {
		const ete = { ...publiee, semaines: semaines.map((s) => (s.debut === '2026-11-06' ? { ...s, groupe: 'Groupe A' } : { ...s, groupe: null })), prochaine: { ...publiee.prochaine, astreinte: { ...publiee.prochaine.astreinte, groupe: 'Groupe A' } } };
		for (const vue of ['semaine', 'mois', 'annee']) {
			const html = page({ planning: ete, vue });
			expect(html).toContain('Groupe A');
		}
		expect(page({ planning: ete, vue: 'annee' })).toContain('Équipe 2');
		expect(page({ planning: ete, vue: 'annee' })).not.toContain('Groupe B');
	});

	it('la carte du Planning ne propose pas la prise de garde, même à la relève', () => {
		expect(page({ maintenant: '2026-11-06T18:30' })).not.toContain('/engins/prise');
	});

	describe('haut de page', () => {
		const demande = { id: 7, genre: 'remplacement', etat: 'attente', demandeur: { id: 2, prenom: 'Bruno', nom: 'Petit' }, cible: null, remplacant: null, texte: 'nuit du lundi 9 novembre', moi: 'destinataire', gestes: {} };
		const CALENDRIER = { semaine: 'id="titre-semaine"', mois: 'id="titre-mois"', annee: 'id="titre-annee"', equipes: 'id="titre-annee"' };
		const ordonne = (html: string, ...reperes: string[]) => {
			const places = reperes.map((r) => html.indexOf(r));
			expect(places.every((x) => x >= 0), reperes.join(' ; ')).toBe(true);
			expect(places).toEqual([...places].sort((a, b) => a - b));
		};

		it.each(Object.entries(CALENDRIER))('vue %s : les vues, la carte et les remplacements avant le calendrier, « À venir » après', (vue, calendrier) => {
			ordonne(page({ vue }), '<h1', 'aria-label="Vue du planning"', 'href="/remplacements/demander?semaine=2026-11-06"', 'href="/remplacements"', calendrier, 'aria-label="Années"', '>À venir');
		});

		it('hors astreinte, même vue Année : les remplacements restent au-dessus du calendrier', () => {
			const sansEquipe = { ...publiee, monEquipe: null, semaines: semaines.map((s) => ({ ...s, mienne: false })), prochaine: { ...publiee.prochaine, astreinte: null } };
			ordonne(page({ planning: sansEquipe, vue: 'annee' }), 'aria-label="Vue du planning"', 'href="/remplacements"', 'id="titre-annee"');
			const finDAnnee = { ...publiee, prochaine: { ...publiee.prochaine, astreinte: null } };
			ordonne(page({ planning: finDAnnee, vue: 'annee', maintenant: '2026-12-30T10:00' }), 'href="/remplacements"', 'id="titre-annee"');
		});

		it('les réponses aux collègues et les validations sont comptées en haut, une demande une seule fois', () => {
			const html = page({ vue: 'annee', remplacements: { ...vides, pourMoi: [demande], aValider: [demande, { ...demande, id: 8 }] } });
			ordonne(html, 'href="/remplacements"', '2 à traiter', 'id="titre-annee"');
			expect(page({ vue: 'annee' })).not.toContain('à traiter');
			// Mes propres demandes ne sont pas à traiter.
			expect(page({ remplacements: { ...vides, miennes: [demande] } })).not.toContain('à traiter');
		});

		it('un seul lien vers les remplacements ; sans rien à venir, pas de section vide', () => {
			const vide = { ...publiee, prochaine: { ...publiee.prochaine, manoeuvre: null, fete: null } };
			const html = page({ planning: vide });
			expect(html.match(/href="\/remplacements"/g)).toHaveLength(1);
			expect(html).not.toContain('À venir');
			expect(html).toMatch(/class="colonnes[^"]*seule/);
			expect(page({})).not.toMatch(/class="colonnes[^"]*seule/);
		});

		it('la carte condensée : ni compte à rebours ni grand titre, les gestes restent', () => {
			const html = page({});
			expect(html).not.toContain('class="rebours');
			expect(html).not.toMatch(/class="quand[^"]*titre/);
			expect(html).toContain('Me faire remplacer');
			expect(html).toContain('Ajouter à mon agenda');
		});

		it('changer de vue garde la position', () => {
			expect(page({}).match(/<a[^>]*href="\?annee=2026&amp;vue=[a-z]+"[^>]*data-sveltekit-reset="false"/g)).toHaveLength(4);
		});
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
		expect(html).toMatch(/action="\?\/repondre&amp;annee=2026&amp;/);
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

	it('Mois au téléphone : la bande de la semaine au-dessus de ses sept jours, pour des cases d’au moins 44 px', () => {
		const html = page({ vue: 'mois' });
		expect((html.match(/<tbody/g) ?? []).length).toBe(5);
		expect(html).toMatch(/<tbody[^>]*>\s*<tr[^>]*><th scope="rowgroup" colspan="7"[^>]*>[\s\S]*?Équipe 1[\s\S]*?S45[\s\S]*?Mon astreinte/);
		expect(html).not.toContain('scope="row"');
		for (const semaine of html.split('<tbody').slice(1)) expect((semaine.split('</tbody>')[0]!.match(/<td/g) ?? []).length).toBe(7);
	});

	it('Mois de décembre : le signe « Fête » le 25 et le 31, même quand la relève tombe à Noël', () => {
		const html = page({ vue: 'mois', mois: 12 });
		expect(html).toContain('vendredi 25 décembre, Férié, Fête, vacances</span>');
		expect(html).toContain('jeudi 31 décembre, Fête, vacances</span>');
	});

	it('Mois de janvier : les fériés d’avant la première relève sont dits', () => {
		expect(page({ vue: 'mois', mois: 1 })).toMatch(/Jour de l’an, jeudi 1er janvier/);
	});

	it('agent d’équipe sans prochaine astreinte (année suivante pas publiée) : pas de carte, la phrase le dit', () => {
		const html = page({ maintenant: '2026-12-30T10:00', planning: { ...publiee, prochaine: { ...publiee.prochaine, astreinte: null } } });
		expect(html).toContain('Le planning 2027 n’est pas encore publié.');
		expect(html).not.toContain('Cette semaine :');
	});

	it('répondre sans JavaScript garde la vue', () => {
		expect(page({ vue: 'mois', mois: 11 })).toMatch(/action="\?\/repondre&amp;annee=2026&amp;vue=mois&amp;semaine=2026-11-06&amp;mois=11"/);
	});

	it('Semaine : « Me faire remplacer » sur chacun de mes jours à venir, le jour pré-choisi', () => {
		const html = page({});
		expect(html).toContain('href="/remplacements/demander?semaine=2026-11-06&amp;jour=2026-11-09"');
		expect((html.match(/href="\/remplacements\/demander\?semaine=2026-11-06&amp;jour=/g) ?? []).length).toBe(7);
		expect(page({ semaine: '2026-11-13' })).not.toContain('jour=2026-11-16');
		// Le samedi à 10 h, la garde de 24 h a commencé : plus de lien ce jour-là ; le dimanche, si.
		const samedi = page({ maintenant: '2026-11-07T10:00' });
		expect(samedi).not.toContain('jour=2026-11-07');
		expect(samedi).toContain('jour=2026-11-08');
		// Le lundi à 10 h, la nuit de 18 h est encore à venir.
		expect(page({ maintenant: '2026-11-09T10:00' })).toContain('jour=2026-11-09');
	});

	it('À venir : « Je ne peux pas : échanger ma place » sur une manœuvre d’équipe, pas sur une manœuvre de tout le centre', () => {
		expect(page({})).toContain('href="/remplacements/manoeuvre?mienne=1&amp;depuis=planning"');
		const tous = { ...publiee, prochaine: { ...publiee.prochaine, manoeuvre: { ...manoeuvre, convocation: 'tous', reponse: null } } };
		expect(page({ planning: tous })).not.toContain('échanger ma place');
	});

	it('garde de fête : la date dite avec l’année quand ce n’est pas l’année en cours', () => {
		const fete = (date: string) => ({ ...publiee, prochaine: { ...publiee.prochaine, fete: { fete: 'nouvel_an', date } } });
		expect(page({ planning: fete('2027-12-31') })).toContain('Votre équipe la tient, le vendredi 31 décembre 2027.');
		expect(page({ planning: fete('2026-12-31') })).toContain('Votre équipe la tient, le jeudi 31 décembre.');
	});

	it('flèches, jours et puces ne font pas remonter la page (SvelteKit 3 ignore « noscroll »)', () => {
		for (const html of [page({}), page({ vue: 'mois' })]) {
			expect(html).not.toContain(['data', 'sveltekit', 'noscroll'].join('-'));
			expect(html).toMatch(/aria-label="(Semaine|Mois) précédente?"[^>]*data-sveltekit-reset="false"|data-sveltekit-reset="false"[^>]*aria-label="(Semaine|Mois) précédente?"/);
		}
		// Un jour du mois mène à sa semaine et fait défiler jusqu'à ce jour (pas en haut de page) : la navigation par défaut suit l'ancre.
		expect(page({ vue: 'mois' })).toMatch(/href="\?annee=2026&amp;vue=semaine&amp;semaine=2026-11-06#jour-2026-11-11"(?![^>]*reset)[^>]*>/);
	});
});

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const equipes = [1, 2].map((id) => ({ id, nom: `Équipe ${id}`, couleur: '#c2185b' }));
const plage = (debut: string, fin: string, arme: boolean) => ({ debut, fin, arme, manque: arme ? [] : ['ca2'], presents: [{ id: 1, prenom: 'Cora', nom: 'Test', renfort: false }, { id: 2, prenom: 'Alice', nom: 'Test', renfort: true }] });
const ete = (autres: Record<string, unknown> = {}) => ({
	annee: 2027,
	ete: { annee: 2027, debut: '2027-06-25', fin: '2027-09-03', dateLimite: '2027-05-15', publiee: false },
	defaut: { debut: '2027-06-25', fin: '2027-08-27', dateLimite: '2027-05-15' },
	sansRoulement: false,
	equipes,
	reponses: [
		{ id: 1, prenom: 'Cora', nom: 'Test', equipeId: 2, reponse: 'tout', periodes: [] },
		{ id: 3, prenom: 'Gina', nom: 'Test', equipeId: 2, reponse: 'vacances', periodes: [{ debut: '2027-07-10', fin: '2027-07-20' }] },
		{ id: 4, prenom: 'Hugo', nom: 'Test', equipeId: 1, reponse: null, periodes: [] }
	],
	proposee: true,
	semaines: [{ debut: '2027-06-25', equipeId: 2, plages: [plage('2027-06-25T18:00', '2027-06-26T06:00', true), plage('2027-06-26T06:00', '2027-06-27T06:00', false)] }],
	impossibles: ['24 h du samedi 26 juin : pas de CA tout engins disponible'],
	conflits: [],
	relanceeAujourdhui: false,
	detail: null,
	...autres
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (e = ete(), autres: Record<string, unknown> = {}) => render(Page as any, { props: { data: { ete: e, etape: 'repartition', panneau: null, ...autres }, form: null } }).body.replace(/<!--[^>]*-->/g, '');

describe('Été : le parcours du chef', () => {
	it('le résumé en tête et les quatre étapes, l’étape en cours marquée', () => {
		const html = page();
		expect(html).toContain('Proposé · 1 semaine · FPT non armé sur 1 plage · 1 agent en vacances · 1 sans réponse');
		expect(html).toMatch(/Étape 3 sur 4/);
		expect(html).toMatch(/<a href="\?annee=2027&amp;etape=repartition"[^>]*aria-current="step"/);
	});

	it('période : une phrase et « Modifier » qui ouvre un panneau ; plus de champs affichés', () => {
		const html = page(ete(), { etape: 'periode' });
		expect(html).toContain('Du ven. 25 juin au jeu. 2 sept. · vacances avant le 15 mai');
		expect(html).toMatch(/<a [^>]*href="\?annee=2027&amp;etape=periode&amp;panneau=periode"[^>]*>Modifier<span class="masque[^"]*"> la période<\/span>/);
		expect(html).not.toContain('type="date"');
		const panneau = page(ete(), { etape: 'periode', panneau: 'periode' });
		expect(panneau).toMatch(/<dialog[^>]*>[\s\S]*name="debut"[^>]*type="date"|<dialog[^>]*>[\s\S]*type="date"[^>]*name="debut"/);
	});

	it('pas encore ouvert : la période par défaut, ouvrir la saisie en un geste', () => {
		const html = page(ete({ ete: null, proposee: false, semaines: [], impossibles: [] }), { etape: 'periode' });
		expect(html).toContain('Pas encore ouvert');
		expect(html).toContain('Du ven. 25 juin au jeu. 2 sept.');
		expect(html).toContain('Ouvrir la saisie des vacances');
	});

	it('vacances : trois rangées avec leur compte, les noms dépliés ; « Relancer » les sans-réponse', () => {
		const html = page(ete(), { etape: 'vacances' });
		expect(html).toMatch(/<summary[^>]*>[\s\S]*?Ont répondu[\s\S]*?>1<[\s\S]*?<\/summary>[\s\S]*?Gina Test[\s\S]*?10 – 20 juil\./);
		expect(html).toMatch(/Sans réponse[\s\S]*?>1<[\s\S]*?Hugo Test/);
		expect(html).toMatch(/Disponibles tout l’été[\s\S]*?>1<[\s\S]*?Cora Test/);
		expect(html).toMatch(/action="\?\/relancer[^"]*"[\s\S]*?Relancer le sans-réponse/);
		const deja = page(ete({ relanceeAujourdhui: true }), { etape: 'vacances' });
		expect(deja).toContain('Relancés aujourd’hui');
		expect(deja).not.toContain('action="?/relancer');
	});

	it('répartition : une rangée par semaine, l’état écrit ; les semaines à revoir en tête ; recalculer dans un menu, avec confirmation', () => {
		const armee = { debut: '2027-07-02', equipeId: 1, plages: [plage('2027-07-02T18:00', '2027-07-03T06:00', true)] };
		const html = page(ete({ semaines: [armee, ...ete().semaines] }));
		const revoir = html.indexOf('2 juil.');
		expect(html.indexOf('⚠ 1 plage à revoir')).toBeGreaterThan(-1);
		expect(html.indexOf('⚠ 1 plage à revoir')).toBeLessThan(revoir);
		expect(html).toContain('✓ FPT armé 1/1');
		expect(html).toMatch(/<a href="\?annee=2027&amp;etape=repartition&amp;plage=2027-06-25T18%3A00"[^>]*>[\s\S]*?Ven\. 25 juin · nuit/);
		expect(html).toMatch(/<details class="menu[^"]*">[\s\S]*?Recalculer la proposition/);
		expect(html).not.toContain('action="?/proposer');
		const confirmer = page(ete(), { panneau: 'recalculer' });
		expect(confirmer).toMatch(/efface vos ajustements[\s\S]*action="\?\/proposer/);
	});

	it('publier : un seul geste par étape, le lien vers l’étape avant, le bouton à la dernière ; publié, l’état le dit', () => {
		for (const etape of ['periode', 'vacances', 'repartition']) {
			expect(page(ete(), { etape })).not.toContain('Publier l’été 2027');
			expect(page(ete(), { etape })).not.toContain('<div class="barre');
		}
		expect(page(ete(), { etape: 'repartition' })).toMatch(/<a class="suivante[^"]*" href="\?annee=2027&amp;etape=publier">Publier ›/);
		const derniere = page(ete(), { etape: 'publier' });
		expect(derniere).toMatch(/<div class="barre[^"]*"[\s\S]*action="\?\/publier[\s\S]*Publier l’été 2027/);
		expect(derniere).toContain('1 plage sans FPT armé : vous pouvez publier quand même.');
		expect(derniere).toMatch(/1 plage où le FPT n’est pas armé · <a [^>]*>Revoir/);
		// Rien à publier encore : le récapitulatif renvoie à la répartition, sans bouton.
		const sansProposition = page(ete({ proposee: false, semaines: [] }), { etape: 'publier' });
		expect(sansProposition).not.toContain('<div class="barre');
		expect(sansProposition.match(/Aller à la répartition/g)).toHaveLength(1);
		const publie = page(ete({ ete: { ...ete().ete, publiee: true } }), { etape: 'publier' });
		expect(publie).not.toContain('Publier l’été 2027');
		expect(publie).toContain('Publiée');
	});

	it('les alertes de la répartition : repliées, avec leur nombre, dans un bloc atteignable au clavier, rappelées avant de publier', () => {
		const conflits = ['nuit du 6 août : Thomas est en vacances, mais présent', '24 h du 7 août : Thomas est en vacances, mais présent'];
		const html = page(ete({ conflits }));
		const bloc = html.match(/<details class="alerte[^"]*">[\s\S]*?<\/details>/)![0];
		expect(bloc).not.toMatch(/<details[^>]* open/);
		expect(bloc).toMatch(/<summary[^>]*>[\s\S]*?⚠<\/span> 2 remplacements à revoir[\s\S]*?<\/summary>/);
		expect(bloc).toContain(conflits[0]);
		expect(html.indexOf('2 remplacements à revoir')).toBeLessThan(html.indexOf('Semaine du'));
		expect(page(ete())).not.toContain('class="alerte');
		expect(page(ete({ conflits }), { etape: 'publier' })).toMatch(/2 remplacements à revoir · <a href="\?annee=2027&amp;etape=repartition">Revoir/);
	});

	it('une plage ouverte : le poste de chacun, ce qui manque en tête ; ceux qui comblent le manque d’abord', () => {
		const detail = {
			...plage('2027-06-25T18:00', '2027-06-26T06:00', false),
			manque: ['ce'],
			presents: [
				{ id: 1, prenom: 'Cora', nom: 'Test', renfort: false, poste: 'cod1' },
				{ id: 2, prenom: 'Alice', nom: 'Test', renfort: true, poste: 'ca2' }
			],
			candidats: [
				{ id: 4, prenom: 'Hugo', nom: 'Test', equipeId: 1, vacances: false, utile: true, postes: ['ce'] },
				{ id: 3, prenom: 'Gina', nom: 'Test', equipeId: 2, vacances: true, utile: false, postes: [] }
			]
		};
		const html = page(ete({ detail }));
		expect(html).toContain('Il manque : 1 CE');
		expect(html.indexOf('Il manque : 1 CE')).toBeLessThan(html.indexOf('Cora Test'));
		expect(html).toMatch(/CA tout engins[\s\S]*?Alice Test<span class="etiquette[^"]*">renfort<\/span>[\s\S]*?Conducteur[\s\S]*?Cora Test/);
		expect(html).toMatch(/Retirer<span class="masque[^"]*"> Alice Test<\/span>/);
		expect(html).toMatch(/Peuvent combler le manque[\s\S]*?Hugo Test[\s\S]*?Autres agents[\s\S]*?Gina Test/);
		expect(html).toMatch(/Ajouter<span class="masque[^"]*"> Hugo Test<\/span>/);
		expect(html).toContain('· en vacances');
	});
});

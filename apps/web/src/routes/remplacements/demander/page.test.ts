import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import { DESSINS, ICONES_ROLES } from '#lib/ui/icones-roles.ts';

const t = (debut: string, fin: string, etat = 'libre') => ({ debut, fin, etat });
const semaine = {
	semaine: '2026-11-06',
	equipeId: 1,
	tranches: [
		t('2026-11-06T18:00', '2026-11-07T06:00', 'passee'),
		t('2026-11-07T06:00', '2026-11-08T06:00'),
		t('2026-11-08T06:00', '2026-11-09T06:00'),
		t('2026-11-09T18:00', '2026-11-10T06:00', 'prise'),
		t('2026-11-10T18:00', '2026-11-11T06:00'),
		t('2026-11-11T18:00', '2026-11-12T06:00'),
		t('2026-11-12T18:00', '2026-11-13T06:00')
	]
};
const autre = { semaine: '2026-12-04', equipeId: 1, tranches: [t('2026-12-04T18:00', '2026-12-05T06:00')] };
const bruno = { id: 2, prenom: 'Bruno', nom: 'Martin', equipe: { nom: 'Équipe 2', couleur: '#1e6fd9' }, aptitudes: ['COD1'], manque: ['CA1'] };
const chloe = { id: 3, prenom: 'Chloé', nom: 'Petit', equipe: { nom: 'Équipe 3', couleur: '#2f9e44' }, aptitudes: ['CA1'], manque: [] };
const nuit = { debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' };
const base = { choix: false, court: false, manqueMoi: [], mode: 'remplacement', maintenant: '2026-11-07T10:00', etape: 'quand', message: null, semaines: [semaine, autre], semaine: null, choisies: [], candidats: [], echangeables: [], pour: null, avec: null, semainesAvec: [], semaineAvec: null, choisiesAvec: [], recherche: '' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data: { ...base, ...data }, form } }).body;

describe('Me faire remplacer : le choix', () => {
	const choix = (court: boolean) => page({ choix: true, court });
	const lignes = (html: string) =>
		html
			.replace(/<!--[\s\S]*?-->/g, '')
			.split('<a class="rangee')
			.slice(1)
			.map((a) => [a.match(/href="([^"]+)"/)?.[1], a.match(/class="titre[^"]*">([^<]+)/)?.[1], a.match(/class="sous[^"]*">([^<]+)/)?.[1], a.match(/<span class="tuile[^"]*" aria-hidden="true"[\s\S]*?<path d="([^"]+)"/)?.[1]]);

	it('d’astreinte aujourd’hui : quatre lignes, quelques heures en tête', () => {
		const html = choix(true);
		expect(html).toMatch(/<h1[^>]*>Me faire remplacer<\/h1>/);
		expect(lignes(html)).toEqual([
			['/remplacements/court', 'Quelques heures aujourd’hui', '2 ou 3 h de votre astreinte du jour', DESSINS.horloge],
			['/remplacements/demander?gardes', 'Une ou plusieurs gardes', 'Choisir la semaine, puis les jours', ICONES_ROLES.calendrier],
			['/remplacements/demander?mode=echange', 'Échanger avec un collègue', 'Sa garde contre la vôtre', DESSINS.remplacer],
			['/remplacements/manoeuvre', 'Échanger ma place à une manœuvre', 'Votre place contre celle d’un collègue', ICONES_ROLES.casque]
		]);
		expect(html.match(/class="lignes/g)).toHaveLength(1);
		// Ni étapes, ni phrase d'introduction ; les icônes, à l'encre, sont décoratives : le texte porte le sens.
		expect(html).not.toContain('Étape');
		expect(html).not.toContain('class="phrase');
		expect(html.match(/<span class="tuile[^"]*" aria-hidden="true"/g)).toHaveLength(4);
		expect(html).toMatch(/href="\/remplacements"[^>]*>[\s\S]*?Remplacements/);
	});

	it('pas d’astreinte aujourd’hui : pas de « Quelques heures »', () => {
		const html = choix(false);
		expect(html).not.toContain('/remplacements/court');
		expect(lignes(html).map((l) => l[1])).toEqual(['Une ou plusieurs gardes', 'Échanger avec un collègue', 'Échanger ma place à une manœuvre']);
	});
});

describe('Me faire remplacer : parcours guidé', () => {
	it('étape 1 : « Étape 1 sur 3 », les semaines en cartes ; aucune bande avant le choix', () => {
		const html = page({});
		expect(html).toContain('Étape 1 sur 3');
		expect(html).toContain('Semaine du 6 – 13 nov.');
		expect(html).toMatch(/href="\?semaine=2026-12-04"[^>]*data-sveltekit-reset="false"/);
		expect(html).not.toContain('type="checkbox"');
		// Le parcours des gardes : son titre, ses trois étapes, le retour au choix ; plus de lien caché vers un autre parcours.
		expect(html).toMatch(/<h1[^>]*>Une ou plusieurs gardes<\/h1>/);
		expect(html).toContain('Trois étapes : quand, à qui');
		expect(html).toMatch(/href="\/remplacements\/demander"[^>]*>[\s\S]*?Me faire remplacer/);
		expect(html).not.toContain('Plutôt');
		expect(html).not.toContain('/remplacements/court');
	});

	it('étape 1, semaine choisie : la bande de 7 jours avec la plage ; passée et déjà demandée inactives, raison écrite ; raccourcis', () => {
		const html = page({ semaine, choisies: [semaine.tranches[1]], maintenant: '2026-11-10T10:00' });
		expect(html.match(/type="checkbox"/g)).toHaveLength(7);
		expect(html.match(/disabled/g)).toHaveLength(2);
		expect(html).toContain('Passée');
		expect(html).toContain('Déjà demandée');
		expect(html).toContain('18 h – 6 h');
		expect(html).toContain('24 h');
		expect(html).toMatch(/value="2026-11-07T06:00\|2026-11-08T06:00" checked/);
		for (const r of ['Ce soir', 'Le week-end', 'Toute la semaine']) expect(html).toContain(`>${r}</a>`);
		expect(html).toMatch(/<button type="submit" name="etape" value="qui"[^>]*>Continuer</);
	});

	it('étape 2 : « Tout le monde » avec le nombre de prévenus, ou un collègue libre : visage, équipe, aptitudes, avertissement', () => {
		const html = page({ etape: 'qui', semaine, choisies: [nuit], candidats: [chloe, bruno] });
		expect(html).toContain('Étape 2 sur 3');
		expect(html).toContain('Vos périodes : <strong>la nuit du lundi 9 novembre (18 h – 6 h)</strong>');
		expect(html).toContain('2 collègues disponibles prévenus');
		expect(html).toMatch(/name="pour" value="tous" checked/);
		expect(html).toContain('Équipe 3 · CA1');
		expect(html).toContain('Il lui manque CA1</strong> : votre chef de garde devra valider.');
		expect(html).toContain('Chercher un collègue');
		expect(html).toMatch(/href="\?semaine=2026-11-06&amp;p=[^"]*"[^>]*>Retour</);
	});

	it('étape 3 : la phrase récapitulative, un mot facultatif, Envoyer (en POST, sans JavaScript)', () => {
		const html = page({ etape: 'verifier', semaine, choisies: [nuit], candidats: [chloe, bruno], pour: 'tous' });
		expect(html).toContain('Étape 3 sur 3');
		expect(html).toContain('Vous demandez à être remplacé la nuit du lundi 9 novembre (18 h – 6 h).');
		expect(html).toContain('2 collègues disponibles sont prévenus.');
		expect(html).toContain('Votre chef de garde sera informé dès qu’un collègue accepte.');
		expect(html).toMatch(/<form method="POST"[\s\S]*name="periode" value="2026-11-09T18:00\|2026-11-10T06:00"[\s\S]*name="pour" value="tous"[\s\S]*Envoyer la demande/);
	});

	it('étape 3, un collègue précis à qui il manque une aptitude : il doit accepter, le chef devra valider', () => {
		const html = page({ etape: 'verifier', semaine, choisies: [nuit], candidats: [bruno], pour: bruno });
		expect(html).toContain('Vous demandez à Bruno Martin de vous remplacer la nuit du lundi 9 novembre (18 h – 6 h).');
		expect(html).toContain('Bruno doit accepter.');
		expect(html).toContain('Il lui manque CA1 : votre chef de garde devra valider.');
		expect(html).toContain('name="pour" value="2"');
	});

	it('échange : quatre étapes, le récapitulatif dit ce que chacun donne', () => {
		const siennes = [{ debut: '2026-11-14T06:00', fin: '2026-11-15T06:00' }];
		const html = page({ mode: 'echange', etape: 'verifier', semaine, choisies: [nuit], avec: chloe, echangeables: [chloe], choisiesAvec: siennes });
		expect(html).toContain('Étape 4 sur 4');
		expect(html).toContain('Vous proposez à Chloé Petit d’échanger : vous lui donnez la nuit du lundi 9 novembre (18 h – 6 h), Chloé vous donne la garde de 24 h du samedi 14 novembre.');
		expect(html).toMatch(/name="periodeCible" value="2026-11-14T06:00\|2026-11-15T06:00"/);
		expect(html).toContain('Proposer l’échange');
		expect(html).toMatch(/<h1[^>]*>Échanger avec un collègue<\/h1>/);
		expect(html).not.toContain('Trois étapes');
		expect(html).not.toContain('Plutôt');
		expect(html).toMatch(/href="\/remplacements\/demander"[^>]*>[\s\S]*?Me faire remplacer/);
	});

	it('les liens du parcours ne retombent jamais sur le choix (adresse sans paramètre)', () => {
		const html = page({ etape: 'qui', semaine: null, choisies: [] });
		expect(html).not.toMatch(/href="\?"/);
		expect(html).toContain('href="?gardes"');
	});

	it('sans astreinte à venir : un vide qui mène au planning', () => {
		expect(page({ semaines: [] })).toContain('Aucune astreinte à venir.');
	});

	it('ouverte à tous sans aucun collègue libre : le dit franchement, pas d’envoi', () => {
		const html = page({ etape: 'verifier', semaine, choisies: [nuit], candidats: [], pour: 'tous' });
		expect(html).toContain('personne ne recevrait la demande');
		expect(html).toContain('Prévenez directement votre chef de garde.');
		expect(html).not.toContain('Envoyer la demande');
	});

	it('échange : l’aptitude qui me manque pour ses périodes est dite aussi', () => {
		const siennes = [{ debut: '2026-11-14T06:00', fin: '2026-11-15T06:00' }];
		const html = page({ mode: 'echange', etape: 'verifier', semaine, choisies: [nuit], avec: { ...chloe, manque: [] }, echangeables: [chloe], choisiesAvec: siennes, manqueMoi: ['CA1'] });
		expect(html).toContain('Il vous manque CA1 pour ses périodes : votre chef de garde devra valider.');
	});

	it('le nom lu de chaque jour est le texte montré', () => {
		const html = page({ semaine });
		expect(html).toMatch(/<span class="nom-jour[^"]*">lundi<\/span>/);
		expect(html).not.toMatch(/<span class="texte[^"]*" aria-hidden/);
	});
});

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const astreinte = { id: 'astreinte', nom: 'Mon astreinte', icone: 'casque', compte: 0 };
const centre = { id: 'centre', nom: 'Le centre', icone: 'etoile', compte: 2 };
const vide = { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [] };
const page = (data: Record<string, unknown>, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { prenom: 'Alice', peutNominations: false, peutReglages: false, aNePasManquer: vide, ...data }, form } }).body;

describe('accueil', () => {
	it('une seule casquette : pas de rangée ; « Bonjour » en tête ; astreinte vide sans fausses données', () => {
		const html = page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' } });
		expect(html).toContain('Bonjour Alice');
		expect(html).not.toContain('aria-label="Casquettes"');
		expect(html).toContain('Votre astreinte s’affichera ici avec le planning.');
	});

	it('plusieurs casquettes : rangée de liens, la choisie marquée, le compteur dans le libellé', () => {
		const html = page({
			casquettes: [centre, astreinte],
			choisie: 'astreinte',
			contenu: { type: 'astreinte' }
		});
		expect(html).toMatch(/<nav[^>]*aria-label="Casquettes"/);
		expect(html).not.toContain('role="tab');
		const lienCentre = html.match(/<a[^>]*href="\?casquette=centre"[^>]*>/)![0];
		expect(lienCentre).toContain('aria-label="Le centre, 2 en attente"');
		expect(lienCentre).not.toContain('aria-current');
		// « true », pas « page » : l'onglet « Accueil » porte déjà « page ».
		expect(html).toMatch(/<a[^>]*href="\?casquette=astreinte"[^>]*aria-current="true"/);
		expect(html).not.toMatch(/aria-current="page"/);
		// Sans puces, VoiceOver perd la liste : rôle explicite.
		expect(html).toMatch(/<nav[^>]*aria-label="Casquettes"[^>]*>\s*<ul[^>]*role="list"/);
		expect(html.indexOf('Bonjour Alice')).toBeLessThan(html.indexOf('aria-label="Casquettes"'));
	});

	it('« Le centre » : « À décider » et les raccourcis permis', () => {
		const html = page({
			casquettes: [centre, astreinte],
			choisie: 'centre',
			peutNominations: true,
			peutReglages: true,
			contenu: { type: 'centre', aDecider: [{ texte: 'Équipe 2 sans chef d’équipe', lien: '/nominations' }] }
		});
		expect(html).toContain('À décider');
		expect(html.match(/<ul[^>]*class="liste[^"]*"[^>]*>/g)!.every((ul) => ul.includes('role="list"'))).toBe(true);
		expect(html).toMatch(/<a[^>]*href="\/nominations"[^>]*>[\s\S]*?Équipe 2 sans chef d’équipe/);
		for (const [href, titre] of [['/agents', 'Agents'], ['/nominations', 'Nominations'], ['/reglages', 'Réglages']]) {
			expect(html).toMatch(new RegExp(`<a[^>]*href="${href}"[^>]*>[\\s\\S]*?${titre}`));
		}
	});

	it('« Le centre » sans rien à décider, sans droit de nommer ni de régler', () => {
		const html = page({ casquettes: [centre, astreinte], choisie: 'centre', contenu: { type: 'centre', aDecider: [] } });
		expect(html).toContain('Rien à décider pour le moment.');
		expect(html).not.toContain('href="/reglages"');
	});

	it('chef d’équipe : vide avec une phrase vraie', () => {
		const html = page({ casquettes: [{ id: 'equipe:1', nom: 'Chef d’équipe · Équipe 1', icone: 'casque', compte: 0 }, astreinte], choisie: 'equipe:1', contenu: { type: 'equipe' } });
		expect(html).toContain('Votre astreinte s’affichera ici avec le planning.');
	});

	it('rôle : ce qu’il permet, en phrases', () => {
		const role = { id: 'role:7', nom: 'Référent pharmacie', icone: 'croix', compte: 0 };
		expect(page({ casquettes: [astreinte, role], choisie: 'role:7', contenu: { type: 'role', permet: ['Gérer le stock et la pharmacie.'] } })).toContain('Gérer le stock et la pharmacie.');
		expect(page({ casquettes: [astreinte, role], choisie: 'role:7', contenu: { type: 'role', permet: [] } })).toContain('Ce rôle n’ajoute rien à ce que fait tout agent.');
	});

	it('comité : membres et rapporteur', () => {
		const html = page({
			casquettes: [astreinte, { id: 'comite:2', nom: 'Amicale', icone: 'groupe', compte: 0 }],
			choisie: 'comite:2',
			contenu: { type: 'comite', membres: [{ personneId: 4, prenom: 'Bruno', nom: 'Petit', role: 'Rapporteur de comité' }, { personneId: 5, prenom: 'Bruno', nom: 'Petit', role: 'Membre de comité' }] }
		});
		expect(html).toContain('Bruno Petit');
		expect(html).toContain('Rapporteur de comité');
		// Deux homonymes : deux lignes (clé par personne).
		expect(html.match(/Bruno Petit/g)).toHaveLength(2);
	});

	it('rien n’attend : pas de section « À ne pas manquer »', () => {
		expect(page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' } })).not.toContain('À ne pas manquer');
	});

	describe('« À ne pas manquer »', () => {
		const item = (id: number, titre: string, cle = 'centre', nomMur = 'Le centre') => ({ id, cle, nomMur, titre });
		const complet = {
			annonces: [item(1, 'Note de service')],
			evenements: [
				{ ...item(2, 'Manœuvre'), debut: '2026-10-29T19:00', demain: true, reponse: null },
				{ ...item(3, 'Repas'), debut: '2026-11-05T12:00', demain: false, reponse: 'absent' }
			],
			sondages: [item(4, 'Repas ?', 'vie', 'Vie du centre'), item(3, 'Repas')],
			epinglees: [item(1, 'Note de service'), item(5, 'Consignes hiver')],
			nouveautes: [{ cle: 'comite:2', nom: 'Amicale', nombre: 3 }, { cle: 'vie', nom: 'Vie du centre', nombre: 1 }]
		};
		const html = (casquette = 'astreinte', form: unknown = null) =>
			page({ casquettes: [centre, astreinte], choisie: casquette, contenu: casquette === 'centre' ? { type: 'centre', aDecider: [] } : { type: 'astreinte' }, aNePasManquer: complet }, form);

		it('en tête de la casquette, sous la rangée des casquettes', () => {
			for (const casquette of ['astreinte', 'centre']) {
				const h = html(casquette);
				expect(h).toMatch(/<h2[^>]*>À ne pas manquer<\/h2>/);
				expect(h.indexOf('aria-label="Casquettes"')).toBeLessThan(h.indexOf('À ne pas manquer'));
			}
			expect(html('centre').indexOf('À ne pas manquer')).toBeLessThan(html('centre').indexOf('À décider'));
		});

		it('annonce : bouton « Pris connaissance » nommé par son titre, envoyé à l’accueil ; épinglée une seule fois', () => {
			const h = html();
			expect(h).toMatch(/<form[^>]*method="POST"[^>]*action="\?casquette=astreinte&amp;\/prendreConnaissance"/);
			expect(h).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*?Pris connaissance<span class="masque[^"]*"> : Note de service<\/span>/);
			expect(h.match(/Note de service/g)).toHaveLength(2);
			expect(h).toMatch(/<a[^>]*href="\/echanges\/centre\/1"/);
			expect(h).toMatch(/<a[^>]*href="\/echanges\/centre\/5"[^>]*>[\s\S]*?Consignes hiver/);
		});

		it('événements : réponse sur place, la sienne marquée, « demain » écrit', () => {
			const h = html();
			expect(h.match(/action="[^"]*\/repondre"/g)).toHaveLength(2);
			expect(h).toMatch(/<button[^>]*name="reponse"[^>]*value="absent"[^>]*aria-pressed="true"/);
			expect(h).toMatch(/<button[^>]*name="reponse"[^>]*value="present"[^>]*aria-pressed="false"/);
			expect(h).toContain('Demain');
			expect(h).toMatch(/role="group"[^>]*aria-labelledby="reponse-2"/);
			// L'événement porte son sondage : une seule fois, sous « Événements ».
			expect(h.match(/href="\/echanges\/centre\/3"/g)).toHaveLength(2);
			expect(h).toMatch(/<a[^>]*href="\/echanges\/centre\/3"[^>]*>Sondage ouvert : votez sur la publication<span class="masque[^"]*"> : Repas<\/span>/);
			const sondages = h.slice(h.indexOf('Sondages ouverts'));
			expect(sondages).not.toContain('/echanges/centre/3');
		});

		it('sondage et nouveautés : des liens', () => {
			const h = html();
			expect(h).toMatch(/<a[^>]*href="\/echanges\/vie\/4"[^>]*>[\s\S]*?Repas \?/);
			expect(h).toMatch(/<a[^>]*href="\/echanges\/comite:2"[^>]*>[\s\S]*?Amicale : 3 nouveautés/);
			expect(h).toContain('Vie du centre : 1 nouveauté<');
		});

		it('sans JavaScript, la casquette choisie est gardée après un geste', () => {
			const h = html('astreinte');
			expect(h).toContain('action="?casquette=astreinte&amp;/prendreConnaissance"');
			expect(h).toContain('action="?casquette=astreinte&amp;/repondre"');
			expect(html('centre')).toContain('action="?casquette=centre&amp;/repondre"');
		});

		it('résultat d’un geste annoncé ; un refus près de l’élément', () => {
			expect(html('astreinte', { cible: 'publication:2', succes: 'Réponse enregistrée : présent.' })).toMatch(/role="status"[^>]*>Réponse enregistrée : présent\./);
			const refus = html('astreinte', { cible: 'publication:2', message: 'Vous n’êtes pas convoqué à cet événement.' });
			expect(refus).toMatch(/role="alert"[^>]*>Vous n’êtes pas convoqué/);
		});
	});
});

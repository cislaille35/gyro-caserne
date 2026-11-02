import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const astreinte = { id: 'astreinte', nom: 'Mon astreinte', icone: 'casque', compte: 0 };
const centre = { id: 'centre', nom: 'Le centre', icone: 'etoile', compte: 2 };
const vide = { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [], remplacements: [] };
const sansMeteo = { meteo: null, vigilance: null };
const page = (data: Record<string, unknown>, form: unknown = null, niveau = 'vivant') =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { prenom: 'Alice', peutNominations: false, peutReglages: false, aNePasManquer: vide, meteo: sansMeteo, ...data }, form }, context: new Map([['affichage', { niveau, theme: 'auto' }]]) }).body;

describe('accueil, météo et vigilance', () => {
	const base = { casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' } };
	const pluie = { meteo: { ambiance: 'pluie', texte: '12 °C · averses · rafales 45 km/h' }, vigilance: null };

	it('la ligne météo sous « Bonjour », avec la mention Open-Meteo ; l’ambiance décorative', () => {
		const html = page({ ...base, meteo: pluie });
		expect(html).toMatch(/Bonjour Alice[\s\S]*Temps au centre : <\/span><span class="source[^"]*">12 °C · averses · rafales 45 km\/h<\/span> <a class="source/);
		expect(html).toMatch(/<a [^>]*href="https:\/\/open-meteo.com\/"[^>]*>Météo : Open-Meteo<\/a>/);
		expect(html).toMatch(/class="meteo m-pluie[^"]*" aria-hidden="true"/);
	});

	it('affichage Sobre : la ligne reste, sans ambiance', () => {
		const html = page({ ...base, meteo: pluie }, null, 'sobre');
		expect(html).toContain('12 °C · averses');
		expect(html).not.toContain('m-pluie');
	});

	it('sans relevé : ni ligne, ni mention, ni ambiance, ni bandeau', () => {
		const html = page(base);
		expect(html).not.toContain('Open-Meteo');
		expect(html).not.toMatch(/class="meteo m-/);
		expect(html).not.toContain('Vigilance');
	});

	it('vigilance : bandeau en tête, le niveau écrit, lien vers Météo-France ; rouge marqué', () => {
		const orange = page({ ...base, meteo: { meteo: null, vigilance: { niveau: 3, lignes: ['Vigilance orange orages, aujourd’hui'] } } });
		expect(orange).toMatch(/<section class="vigilance[^"]*" aria-label="Vigilance météo">[\s\S]*Vigilance orange orages, aujourd’hui[\s\S]*href="https:\/\/vigilance.meteofrance.fr\/"/);
		expect(orange.indexOf('Vigilance orange')).toBeLessThan(orange.indexOf('Bonjour Alice'));
		expect(orange).not.toMatch(/class="vigilance[^"]*rouge/);
		const rouge = page({ ...base, meteo: { meteo: null, vigilance: { niveau: 4, lignes: ['Vigilance orange orages, aujourd’hui', 'Vigilance rouge orages, demain'] } } });
		expect(rouge).toMatch(/class="vigilance[^"]*rouge/);
		expect(rouge).toContain('Vigilance rouge orages, demain');
	});
});

describe('accueil', () => {
	it('une demande de remplacement reçue : dans « À ne pas manquer », vers la demande', () => {
		const html = page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' }, aNePasManquer: { ...vide, remplacements: [{ id: 4, titre: 'Alice Test cherche un remplaçant', sous: 'nuit du lundi 9 novembre', debut: '2026-11-09T18:00' }] } });
		expect(html).toMatch(/href="\/remplacements\/4"[^>]*>[\s\S]*?Alice Test cherche un remplaçant/);
		expect(html).toContain('nuit du lundi 9 novembre · Accepter ou refuser');
		expect(html).not.toContain('Tout est à jour');
	});

	it('une seule casquette : pas de rangée ; « Bonjour » en tête ; pas de fausse astreinte', () => {
		const html = page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' } });
		expect(html).toContain('Bonjour Alice');
		expect(html).not.toContain('aria-label="Casquettes"');
		expect(html).not.toContain('Bientôt');
		expect(html).not.toContain('Ma prochaine astreinte');
	});

	it('la carte astreinte en tête, compacte, vers le Planning ; l’équipe écrite', () => {
		const periodes = [{ debut: '2026-11-20T18:00', fin: '2026-11-23T06:00' }, { debut: '2026-11-23T18:00', fin: '2026-11-27T06:00' }];
		const a = { debut: '2026-11-20T18:00', fin: '2026-11-27T06:00', equipe: { id: 3, nom: 'Équipe 3', couleur: '#1565c0' }, enCours: false, mienne: true, periodes };
		const html = page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' }, astreinte: a, maintenant: '2026-11-01T10:00' });
		expect(html).toMatch(/class="carte[^"]*compacte[\s\S]*?<a[^>]*href="\/planning"[^>]*>Voir le planning/);
		expect(html).toContain('href="/remplacements/demander?semaine=2026-11-20"');
		expect(html).toContain('Votre équipe est d’astreinte dans 19 jours');
		expect(html).toContain('Du ven. 20 nov. 18 h au ven. 27 nov. 6 h');
		expect(html).toContain('Équipe 3');
		expect(html.indexOf('Ma prochaine astreinte')).toBeLessThan(html.indexOf('Raccourcis'));
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
			contenu: { type: 'centre', aDecider: [{ texte: 'Équipe 2 sans chef de garde', lien: '/nominations' }] }
		});
		expect(html).toContain('À décider');
		expect(html.match(/<ul[^>]*>/g)!.every((ul) => ul.includes('role="list"'))).toBe(true);
		// À décider : une alerte, pas seulement une couleur.
		expect(html).toMatch(/<a[^>]*class="rangee[^"]*alerte[^"]*"[^>]*href="\/nominations"/);
		expect(html).toContain('class="signe');
		expect(html).toMatch(/<a[^>]*href="\/nominations"[^>]*>[\s\S]*?Équipe 2 sans chef de garde/);
		for (const [href, titre] of [['/agents', 'Agents'], ['/nominations', 'Nominations'], ['/reglages', 'Réglages']]) {
			expect(html).toMatch(new RegExp(`<a[^>]*href="${href}"[^>]*>[\\s\\S]*?${titre}`));
		}
	});

	it('« Le centre » sans rien à décider, sans droit de nommer ni de régler', () => {
		const html = page({ casquettes: [centre, astreinte], choisie: 'centre', contenu: { type: 'centre', aDecider: [] } });
		expect(html).toContain('Rien à décider pour le moment.');
		expect(html).not.toContain('href="/reglages"');
	});

	it('« À décider » : trois visibles, le reste derrière « Voir les autres »', () => {
		const aDecider = ['Équipe 2', 'Équipe 3', 'Pharmacie', 'Engins', 'Fiches'].map((t) => ({ texte: `${t} à pourvoir`, lien: '/nominations' }));
		const html = page({ casquettes: [centre, astreinte], choisie: 'centre', contenu: { type: 'centre', aDecider } });
		const visibles = html.slice(0, html.indexOf('<details'));
		expect(visibles).toContain('Pharmacie à pourvoir');
		expect(visibles).not.toContain('Engins à pourvoir');
		expect(html).toMatch(/<details[^>]*>\s*<summary[^>]*>Voir les 2 autres<\/summary>[\s\S]*?Engins à pourvoir[\s\S]*?Fiches à pourvoir/);
	});

	it('un agent : ses raccourcis et une phrase qui dit ce qui l’attend', () => {
		const html = page({ estPersonne: true, casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' } });
		for (const href of ['/echanges', '/agents', '/profil']) expect(html).toContain(`href="${href}"`);
		// « Tout est à jour » une seule fois.
		expect(html.match(/[Tt]out est à jour/g)).toHaveLength(1);
		const occupe = page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' }, aNePasManquer: { ...vide, sondages: [{ id: 4, cle: 'vie', nomMur: 'Vie du centre', titre: 'Repas ?' }] } });
		expect(occupe).toContain('1 publication vous attend.');
		const deux = page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' }, aNePasManquer: { ...vide, sondages: [1, 2].map((id) => ({ id, cle: 'vie', nomMur: 'Vie du centre', titre: `Repas ${id} ?` })) } });
		expect(deux).toContain('2 publications vous attendent.');
	});

	it('chef de garde : vide avec une phrase vraie', () => {
		const html = page({ casquettes: [{ id: 'equipe:1', nom: 'Chef de garde · Équipe 1', icone: 'casque', compte: 0 }, astreinte], choisie: 'equipe:1', contenu: { type: 'equipe', aDecider: [] } });
		expect(html).not.toContain('Bientôt');
		expect(html).toContain('Aucun remplacement à valider.');
	});

	it('chef de garde : les remplacements à valider « À décider »', () => {
		const aDecider = [{ texte: 'Remplacement à valider · Alice Test · nuit du lundi 9 novembre', lien: '/remplacements/3' }];
		const html = page({ casquettes: [{ id: 'equipe:1', nom: 'Chef de garde · Équipe 1', icone: 'casque', compte: 1 }, astreinte], choisie: 'equipe:1', contenu: { type: 'equipe', aDecider } });
		expect(html).toMatch(/href="\/remplacements\/3"[^>]*>[\s\S]*?Remplacement à valider · Alice Test/);
	});

	it('rôle : ce qu’il permet, en phrases', () => {
		const role = { id: 'role:7', nom: 'Référent pharmacie', icone: 'croix', compte: 0 };
		expect(page({ casquettes: [astreinte, role], choisie: 'role:7', contenu: { type: 'role', permet: ['Gérer le stock et la pharmacie.'], aDecider: [] } })).toContain('Gérer le stock et la pharmacie.');
		expect(page({ casquettes: [astreinte, role], choisie: 'role:7', contenu: { type: 'role', permet: [], aDecider: [] } })).toContain('Ce rôle n’ajoute rien à ce que fait tout agent.');
	});

	it('rôle ou comité qui gère une ressource : ses demandes de réservation « À décider », en tête', () => {
		const aDecider = [{ texte: 'Bancs · 4 · du 12 au 14 nov. · Alice Test', lien: '/reservations/a-valider' }];
		const amicale = page({ casquettes: [astreinte, { id: 'comite:2', nom: 'Amicale', icone: 'groupe', compte: 1 }], choisie: 'comite:2', contenu: { type: 'comite', membres: [], aDecider } });
		expect(amicale).toMatch(/<h2[^>]*>À décider[\s\S]*?href="\/reservations\/a-valider"[\s\S]*?Bancs · 4 · du 12 au 14 nov\. · Alice Test[\s\S]*?Membres/);
		const engins = page({ casquettes: [astreinte, { id: 'role:6', nom: 'Référent engins', icone: 'camion', compte: 0 }], choisie: 'role:6', contenu: { type: 'role', permet: [], aDecider: [] } });
		expect(engins).not.toContain('À décider');
	});

	it('comité : membres et rapporteur', () => {
		const html = page({
			casquettes: [astreinte, { id: 'comite:2', nom: 'Amicale', icone: 'groupe', compte: 0 }],
			choisie: 'comite:2',
			contenu: { type: 'comite', membres: [{ personneId: 4, prenom: 'Bruno', nom: 'Petit', role: 'Rapporteur de comité' }, { personneId: 5, prenom: 'Bruno', nom: 'Petit', role: 'Membre de comité' }], aDecider: [] }
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
				expect(h).toMatch(/<h2[^>]*>À ne pas manquer/);
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
			expect(h).toMatch(/<a[^>]*href="\/echanges\/centre\/3"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Sondage ouvert : votez sur la publication<span class="masque[^"]*"> : Repas<\/span>/);
			const sondages = h.slice(h.indexOf('Sondages ouverts'));
			expect(sondages).not.toContain('/echanges/centre/3');
		});

		it('sondage et nouveautés : des liens', () => {
			const h = html();
			expect(h).toMatch(/<a[^>]*href="\/echanges\/vie\/4"[^>]*>[\s\S]*?Repas \?/);
			expect(h).toMatch(/<a[^>]*href="\/echanges\/comite:2"[^>]*>[\s\S]*?Amicale[\s\S]*?3 nouveautés/);
			expect(h).toMatch(/Vie du centre<[\s\S]*?>1 nouveauté</);
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

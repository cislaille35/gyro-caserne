import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import { HUMEURS, humeurDuJour } from '#lib/gyro/humeurs.ts';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { nombreAFaire } from '#lib/a-faire.ts';

const astreinte = { id: 'astreinte', nom: 'Mon astreinte', icone: 'casque', compte: 0 };
const centre = { id: 'centre', nom: 'Le centre', icone: 'etoile', compte: 2 };
const vide = { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [], remplacements: [] };
const sansMeteo = { meteo: null, vigilance: null };
const page = (data: Record<string, unknown>, form: unknown = null, niveau = 'vivant') =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { prenom: 'Alice', peutNominations: false, peutReglages: false, aNePasManquer: vide, meteo: sansMeteo, ...data }, form }, context: new Map([['affichage', { niveau, theme: 'auto' }]]) }).body;

const texte = (html: string) => html.replace(/<!--.*?-->|<[^>]+>/g, '');

describe('accueil, météo et vigilance', () => {
	const base = { casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' } };
	const pluie = { meteo: { ambiance: 'pluie', texte: '12 °C, averses, rafales 45 km/h' }, vigilance: null };

	it('la ligne météo sous « Bonjour », avec la mention Open-Meteo ; l’ambiance décorative', () => {
		const html = page({ ...base, meteo: pluie });
		expect(html).toMatch(/Bonjour Alice[\s\S]*Temps au centre : <\/span><span class="source[^"]*">12 °C, averses, rafales 45 km\/h<\/span> <a class="source/);
		expect(html).toMatch(/<a [^>]*href="https:\/\/open-meteo.com\/"[^>]*>Météo : Open-Meteo<\/a>/);
		expect(html).toMatch(/class="meteo m-pluie[^"]*" aria-hidden="true"/);
	});

	describe('pas de soleil la nuit, même si le relevé date d’avant le coucher', () => {
		afterEach(() => vi.useRealTimers());
		// Le relevé (une fois par heure) dit encore « de jour » ; le centre fictif voit le soleil se coucher vers 21 h 25 le 10 août.
		const clair = { meteo: { ambiance: 'clair', texte: '24 °C, ciel clair', nuit: false }, vigilance: null };
		it.each([
			['2026-08-10T19:00Z', true],
			['2026-08-10T19:45Z', false]
		])('%s : soleil %s', (heure, soleil) => {
			vi.useFakeTimers({ now: new Date(heure), toFake: ['Date'] });
			const html = page({ ...base, meteo: clair });
			expect(html.includes('class="soleil'), 'décor').toBe(soleil);
			expect(html.includes('en lunettes de soleil') || /<circle cx="132" cy="30" r="13"/.test(html), 'Gyro').toBe(soleil);
		});
	});

	it('affichage Sobre : la ligne reste, sans ambiance', () => {
		const html = page({ ...base, meteo: pluie }, null, 'sobre');
		expect(html).toContain('12 °C, averses');
		expect(html).not.toContain('m-pluie');
	});

	it('sans relevé : ni ligne, ni mention, ni ambiance, ni bandeau', () => {
		const html = page(base);
		expect(html).not.toContain('Open-Meteo');
		expect(html).not.toMatch(/class="meteo m-/);
		expect(html).not.toContain('Vigilance');
	});

	it('Vivant : l’humeur du jour de Gyro sous « Bonjour » ; aucune en Équilibré ni à côté d’un bandeau de vigilance', () => {
		const humeur = humeurDuJour(aujourdhuiParis(), 'accueil');
		expect(texte(page(base))).toContain(humeur);
		const sansHumeur = (html: string) => HUMEURS.every((h) => !texte(html).includes(h));
		expect(sansHumeur(page(base, null, 'equilibre'))).toBe(true);
		expect(sansHumeur(page({ ...base, meteo: { meteo: null, vigilance: { etat: 'ok', niveau: 3, lignes: ['Vigilance orange orages, aujourd’hui'], lieu: '35' } } }))).toBe(true);
	});

	it('vigilance : bandeau en tête, le niveau écrit, lien vers Météo-France ; rouge marqué', () => {
		const orange = page({ ...base, meteo: { meteo: null, vigilance: { etat: 'ok', niveau: 3, lignes: ['Vigilance orange orages, aujourd’hui'], lieu: 'Ille-et-Vilaine' } } });
		expect(orange).toMatch(/<section class="vigilance[^"]*" aria-label="Vigilance météo">[\s\S]*Vigilance orange orages, aujourd’hui[\s\S]*href="https:\/\/vigilance.meteofrance.fr\/"/);
		expect(orange.indexOf('Vigilance orange')).toBeLessThan(orange.indexOf('Bonjour Alice'));
		expect(orange).not.toMatch(/class="vigilance[^"]*rouge/);
		const rouge = page({ ...base, meteo: { meteo: null, vigilance: { etat: 'ok', niveau: 4, lieu: '35', lignes: ['Vigilance orange orages, aujourd’hui', 'Vigilance rouge orages, demain'] } } });
		expect(rouge).toMatch(/class="vigilance[^"]*rouge/);
		expect(rouge).toContain('Vigilance rouge orages, demain');
		expect(rouge).not.toContain('class="vigilance-discrete');
	});

	const lienVigilance = /<a [^>]*href="https:\/\/vigilance.meteofrance.fr\/"[^>]*>/;
	it('vert : une petite ligne à côté de la ligne météo, avec le département et le lien', () => {
		const html = page({ ...base, meteo: { meteo: pluie.meteo, vigilance: { etat: 'ok', niveau: 1, lignes: [], lieu: 'Ille-et-Vilaine' } } });
		expect(html).toMatch(/12 °C, averses[\s\S]*class="vigilance-discrete[^"]*"/);
		expect(texte(html)).toContain('Vigilance verte · Ille-et-Vilaine');
		expect(html).toMatch(lienVigilance);
		expect(html).not.toContain('aria-label="Vigilance météo"');
	});

	it('jaune : le mot et le phénomène écrits, avec un jeton ; la ligne reste discrète, même sans relevé météo', () => {
		const html = page({ ...base, meteo: { meteo: null, vigilance: { etat: 'ok', niveau: 2, lignes: ['Vigilance jaune orages, aujourd’hui'], lieu: '35' } } });
		expect(html).toMatch(/class="vigilance-discrete[^"]*niveau-2[\s\S]*class="jeton[^"]*" aria-hidden="true"[\s\S]*Vigilance jaune orages, aujourd’hui/);
		expect(texte(html)).toContain('Vigilance jaune orages, aujourd’hui · 35');
		expect(html).not.toContain('aria-label="Vigilance météo"');
	});

	it('indisponible : la ligne le dit et renvoie vers Météo-France', () => {
		const html = page({ ...base, meteo: { meteo: null, vigilance: { etat: 'indisponible' } } });
		expect(html).toMatch(/Vigilance indisponible, voir Météo-France/);
		expect(html).toMatch(lienVigilance);
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

	describe('la plaque d’astreinte', () => {
		const periodes = [{ debut: '2026-11-20T18:00', fin: '2026-11-23T06:00' }, { debut: '2026-11-23T18:00', fin: '2026-11-27T06:00' }];
		const carte = (autres = {}) => ({ debut: '2026-11-20T18:00', fin: '2026-11-27T06:00', equipe: { id: 3, nom: 'Équipe 3', couleur: '#1565c0' }, enCours: false, mienne: true, periodes, ...autres });
		const accueil = (a: unknown, maintenant: string, priseOuverte = false) => page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' }, astreinte: a, maintenant, priseOuverte });
		const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
		const grand = (html: string) => html.match(/<p class="grand[^"]*">([\s\S]*?)<\/p>/)![1]!.replace(/<[^>]+>/g, '').trim();

		it('à venir : à-plat de la couleur de l’équipe, texte noir ou blanc selon elle, grand compte à rebours, dates à droite', () => {
			const html = accueil(carte(), '2026-11-01T10:00');
			expect(html).toMatch(/class="plaque[^"]*compacte[^"]*"[^>]*style="--equipe: #1565c0; --sur-equipe: #ffffff; --sur-bouton: #1d2733;"/);
			expect(html).toMatch(/<h2 class="masque">Ma prochaine astreinte<\/h2>/);
			expect(texte(html)).toContain('19 jours avant votre astreinte');
			expect(texte(html)).toContain('Équipe 3 Du ven. 20 nov. 18 h au ven. 27 nov. 6 h');
			// Les mots masqués gardent leurs espaces : lus « Du ven. 20 nov. 18 h au ven. 27 nov. 6 h ».
			expect(html.match(/<p class="dates[^"]*">([\s\S]*?)<\/p>/)![1]!.replace(/<[^>]+>/g, '')).toBe('Du ven. 20 nov. 18 h au ven. 27 nov. 6 h');
			// Les gestes dans la bande sous la plaque.
			expect(html).toMatch(/class="gestes[\s\S]*?href="\/remplacements\/demander\?semaine=2026-11-20"[\s\S]*?Me faire remplacer[\s\S]*?href="\/moi\/agenda"/);
			expect(html).not.toContain('Voir le planning');
			// Le bleu de Laillé : ni l'anthracite ni le blanc n'atteignent 4,5:1, le noir pur oui.
			expect(accueil(carte({ equipe: { id: 3, nom: 'Équipe 3', couleur: '#3d7fd6' } }), '2026-11-01T10:00')).toContain('--sur-equipe: #000000; --sur-bouton: #ffffff;');
			expect(accueil(carte({ equipe: { id: 1, nom: 'Équipe 1', couleur: '#f2c200' } }), '2026-11-01T10:00')).toContain('--sur-equipe: #1d2733; --sur-bouton: #ffffff;');
		});

		it('le soir de la relève : « ce soir 18 h » en grand, « Faire la prise de garde » sur la plaque, « Voir ma semaine »', () => {
			const html = accueil(carte(), '2026-11-20T16:30', true);
			expect(texte(html)).toContain('Équipe 3 · relève jusqu’au ven. 27 nov. 6 h');
			expect(grand(html)).toBe('Début de l’astreinte : ce soir 18 h');
			expect(html).toMatch(/<span class="masque[^"]*">Début de l’astreinte : <\/span>/);
			expect(html).toMatch(/class="aplat[\s\S]*?<a class="prise[^"]*" href="\/engins\/prise">[\s\S]*?Faire la prise de garde/);
			expect(html).toContain('href="/planning?annee=2026&amp;vue=semaine&amp;semaine=2026-11-20"');
			expect(accueil(carte(), '2026-11-20T16:30', false)).not.toContain('/engins/prise');
			// La veille : « demain 18 h ».
			expect(accueil(carte(), '2026-11-19T12:00')).toMatch(/<p class="grand[^"]*">[\s\S]*?demain 18 h<\/p>/);
		});

		it('en cours : « En cours », la plage du moment', () => {
			const html = accueil(carte({ enCours: true }), '2026-11-21T10:00');
			expect(html).toMatch(/<h2 class="masque">Mon astreinte en cours<\/h2>/);
			expect(grand(html)).toBe('En cours');
			expect(texte(html)).toContain('En ce moment, jusqu’à');
			// Pendant l'astreinte, dans la fenêtre de la relève (jusqu'24 h après), la prise reste à portée.
			expect(accueil(carte({ enCours: true }), '2026-11-20T18:30', true)).toMatch(/class="aplat[\s\S]*?<a class="prise[^"]*" href="\/engins\/prise">/);
			expect(accueil(carte({ enCours: true }), '2026-11-21T10:00', false)).not.toContain('/engins/prise');
		});

		it('une autre équipe : son nom en grand, « Voir le planning », ni remplacement ni prise', () => {
			const html = accueil(carte({ mienne: false }), '2026-11-20T19:00', true);
			expect(texte(html)).toContain('Équipe 3 d’astreinte');
			expect(html).toMatch(/<a class="planning[^"]*" href="\/planning">Voir le planning/);
			expect(html).not.toContain('/remplacements/demander');
			expect(html).not.toContain('/engins/prise');
		});
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

	it('« Le centre » : « À décider » et les liens permis', () => {
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

	describe('« À décider » en tête', () => {
		const aDecider = [{ texte: 'Équipe 2 sans chef de garde', lien: '/nominations' }];
		const aNePasManquer = { ...vide, sondages: [{ id: 4, cle: 'vie', nomMur: 'Vie du centre', titre: 'Repas ?' }] };
		const colonnes = (html: string) => html.split(/class="colonne\s/).slice(1);

		it.each([
			['le centre', centre, { type: 'centre', aDecider }],
			['un rôle', { id: 'role:6', nom: 'Référent', icone: 'camion', compte: 1 }, { type: 'role', permet: [], aDecider }],
			['un comité', { id: 'comite:2', nom: 'Amicale', icone: 'groupe', compte: 1 }, { type: 'comite', membres: [], aDecider }]
		])('%s : avant « À ne pas manquer », dans la première colonne', (_nom, casquette, contenu) => {
			const html = page({ casquettes: [casquette, astreinte], choisie: casquette.id, aNePasManquer, contenu });
			expect(html.indexOf('À décider')).toBeLessThan(html.indexOf('À ne pas manquer'));
			expect(colonnes(html)).toHaveLength(2);
			expect(colonnes(html)[0]).toContain('À décider');
			expect(colonnes(html)[0]).toContain('À ne pas manquer');
			expect(colonnes(html)[1]).not.toContain('À décider');
		});

		it('un chef de garde : en tête, sans colonne vide à côté', () => {
			const html = page({ casquettes: [{ id: 'equipe:1', nom: 'Chef de garde · Équipe 1', icone: 'casque', compte: 1 }, astreinte], choisie: 'equipe:1', aNePasManquer, contenu: { type: 'equipe', aDecider } });
			expect(html.indexOf('À décider')).toBeLessThan(html.indexOf('À ne pas manquer'));
			expect(colonnes(html)).toHaveLength(1);
			expect(html).toMatch(/class="colonnes[^"]*seule/);
		});

		it('rien à décider : « À ne pas manquer » d’abord, la phrase vraie à côté', () => {
			const html = page({ casquettes: [centre, astreinte], choisie: 'centre', aNePasManquer, contenu: { type: 'centre', aDecider: [] } });
			expect(colonnes(html)[0]).toContain('À ne pas manquer');
			expect(colonnes(html)[1]).toContain('Rien à décider pour le moment.');
		});

		it('« Gérer » reste au chef ; « Habillement » s’y ajoute quand aucun référent habillement n’est nommé', () => {
			const html = page({ casquettes: [centre, astreinte], choisie: 'centre', contenu: { type: 'centre', aDecider } });
			expect(colonnes(html)[1]).toMatch(/Gérer[\s\S]*?href="\/agents"/);
			expect(html).not.toContain('href="/habillement/toutes"');
			const sans = page({ casquettes: [centre, astreinte], choisie: 'centre', contenu: { type: 'centre', aDecider, habillement: true } });
			expect(colonnes(sans)[1]).toMatch(/Gérer[\s\S]*?href="\/habillement\/toutes"[^>]*>[\s\S]*?Habillement/);
		});
	});

	it('un agent : plus de raccourcis, une colonne, et une phrase qui dit ce qui l’attend', () => {
		const html = page({ estPersonne: true, casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' } });
		expect(html).not.toContain('Raccourcis');
		for (const href of ['/echanges', '/agents', '/profil']) expect(html).not.toContain(`href="${href}"`);
		expect(html.split(/class="colonne\s/)).toHaveLength(2);
		expect(html).toMatch(/class="colonnes[^"]*seule/);
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
		const aDecider = [{ texte: 'Remplacement à valider, Alice Test, nuit du lundi 9 novembre', lien: '/remplacements/3' }];
		const html = page({ casquettes: [{ id: 'equipe:1', nom: 'Chef de garde · Équipe 1', icone: 'casque', compte: 1 }, astreinte], choisie: 'equipe:1', contenu: { type: 'equipe', aDecider } });
		expect(html).toMatch(/href="\/remplacements\/3"[^>]*>[\s\S]*?Remplacement à valider, Alice Test/);
	});

	it('rôle : ce qu’il permet, en phrases', () => {
		const role = { id: 'role:7', nom: 'Référent pharmacie', icone: 'croix', compte: 0 };
		expect(page({ casquettes: [astreinte, role], choisie: 'role:7', contenu: { type: 'role', permet: ['Gérer le stock et la pharmacie.'], aDecider: [] } })).toContain('Gérer le stock et la pharmacie.');
		expect(page({ casquettes: [astreinte, role], choisie: 'role:7', contenu: { type: 'role', permet: [], aDecider: [] } })).toContain('Ce rôle n’ajoute rien à ce que fait tout agent.');
	});

	it('rôle de référent habillement : un raccourci vers toutes les demandes', () => {
		const role = { id: 'role:8', nom: 'Référent habillement', icone: 'veste', compte: 0 };
		const html = page({ casquettes: [astreinte, role], choisie: 'role:8', contenu: { type: 'role', permet: ['Gérer les demandes d’habillement.'], aDecider: [], liens: [{ texte: 'Toutes les demandes d’habillement', lien: '/habillement/toutes' }] } });
		expect(html).toMatch(/Raccourcis[\s\S]*?href="\/habillement\/toutes"[\s\S]*?Toutes les demandes d’habillement/);
	});

	it('rôle ou comité qui gère une ressource : ses demandes de réservation « À décider », en tête', () => {
		const aDecider = [{ texte: 'Bancs, 4, du 12 au 14 nov., Alice Test', lien: '/reservations/a-valider' }];
		const amicale = page({ casquettes: [astreinte, { id: 'comite:2', nom: 'Amicale', icone: 'groupe', compte: 1 }], choisie: 'comite:2', contenu: { type: 'comite', membres: [], aDecider } });
		expect(amicale).toMatch(/<h2[^>]*>À décider[\s\S]*?href="\/reservations\/a-valider"[\s\S]*?Bancs, 4, du 12 au 14 nov\., Alice Test[\s\S]*?Membres/);
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
				{ ...item(2, 'Manœuvre'), debut: '2026-10-29T19:00', demain: true, enCours: false, reponse: null },
				{ ...item(3, 'Repas'), debut: '2026-11-05T12:00', demain: false, enCours: false, reponse: 'absent' }
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

		it('événement en cours : « En cours » écrit, plus de réponse ; il n’attend plus rien de la personne', () => {
			const enCours = { ...item(6, 'Exercice incendie'), debut: '2026-10-28T14:00', demain: false, enCours: true, reponse: null };
			const avec = page({ casquettes: [astreinte], choisie: 'astreinte', contenu: { type: 'astreinte' }, aNePasManquer: { ...complet, evenements: [enCours, ...complet.evenements] } });
			const ligne = avec.slice(avec.indexOf('Exercice incendie'), avec.indexOf('/echanges/centre/2'));
			expect(ligne).toContain('En cours');
			expect(ligne).not.toContain('name="reponse"');
			expect(avec.match(/action="[^"]*\/repondre"/g)).toHaveLength(2);
			expect(html()).not.toContain('En cours');
			expect(nombreAFaire({ ...complet, remplacements: [], evenements: [enCours, ...complet.evenements] } as never)).toBe(nombreAFaire({ ...complet, remplacements: [] } as never));
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

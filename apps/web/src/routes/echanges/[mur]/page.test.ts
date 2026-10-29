import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { PublicationVue } from '@gyro-caserne/socle';
import Page from './+page.svelte';

const pub = (p: Partial<PublicationVue> = {}): PublicationVue => ({
	id: 1,
	cle: 'vie',
	auteur: { prenom: 'Alice', nom: 'Martin', couleur: null, role: null, ecrireA: null },
	type: 'message',
	texte: 'Bonjour',
	creeLe: '2026-10-28T14:05:00',
	modifieeLe: null,
	epinglee: false,
	commentairesFermes: false,
	photos: [],
	jaime: 0,
	commentaires: 0,
	jaimeParMoi: false,
	evenement: null,
	sondage: null,
	priseDeConnaissance: null,
	derniersCommentaires: [],
	droits: { modifier: false, supprimer: false, epingler: false, fermer: false },
	...p
});
const mur = { cle: 'vie', nom: 'Vie du centre', type: 'vie', peutPublier: true, peutModerer: false, lectureSeule: false };
const equipes = [
	{ id: 1, nom: 'Équipe 1', active: 1 },
	{ id: 2, nom: 'Équipe 2', active: 1 },
	{ id: 3, nom: 'Équipe 3', active: 0 }
];
const tuile = (cle: string, autre: Record<string, unknown> = {}) => ({ cle, membre: true, icone: null, couleur: null, numero: null, derniere: null, nouveautes: 0, aConfirmer: 0, ...autre });
const sections = {
	centre: tuile('centre', { icone: 'maison', nom: 'Le centre', type: 'centre' }),
	groupes: [tuile('equipe:1', { couleur: '#d4a017', numero: 1, nom: 'Équipe 1', type: 'equipe' }), tuile('vie', { icone: 'groupe', nom: 'Vie du centre', type: 'vie' })],
	autres: [],
	supervision: []
};
const html = (data: Record<string, unknown> = {}, form: unknown = null, niveau = 'equilibre') =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, {
		props: { data: { mur, audience: 38, epinglees: [], publications: [], suite: null, equipes, plusAnciennes: false, anniversaires: [], sections, ...data }, form },
		context: new Map([['affichage', { niveau, theme: 'auto' }]])
	}).body;

describe('page d’un mur', () => {
	it('cibles du focus après « Publier » : chaque publication, puis le titre du mur', () => {
		const page = html({ epinglees: [pub({ id: 9, epinglee: true })], publications: [pub()] });
		expect(page).toMatch(/<article[^>]*id="publication-9"[^>]*tabindex="-1"/);
		expect(page).toMatch(/<article[^>]*id="publication-1"[^>]*tabindex="-1"/);
		expect(page).toMatch(/<h1 id="titre-mur" tabindex="-1"/);
	});

	it('le texte n’est jamais interprété comme du HTML', () => {
		const page = html({ publications: [pub({ texte: '<img src=x onerror=alert(1)>\nLigne 2' })] });
		expect(page).not.toContain('<img src=x');
		expect(page).toContain('&lt;img src=x onerror=alert(1)>\nLigne 2');
	});

	it('épinglées puis publications, auteur et date, « Voir plus »', () => {
		const page = html({ epinglees: [pub({ id: 9, texte: 'Épinglée', epinglee: true })], publications: [pub()], suite: 1 });
		expect(page.indexOf('Épinglée')).toBeLessThan(page.indexOf('Bonjour'));
		expect(page).toContain('Alice Martin');
		expect(page).toContain('<time datetime="2026-10-28T14:05:00"');
		expect(page).toContain('href="?avant=1"');
		expect(page).not.toContain('Revenir aux plus récentes');
		expect(html({ plusAnciennes: true })).toContain('Revenir aux plus récentes');
	});

	it('montre l’événement, le sondage, les photos privées et les comptes, en texte', () => {
		const page = html({
			publications: [
				pub({
					type: 'evenement',
					evenement: { debut: '2026-11-05T19:30', lieu: 'Caserne', convoques: [2], convoque: true, reponse: null, compte: { present: 0, absent: 0, incertain: 0 }, presents: [] },
					sondage: { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ouverture: null, cloture: null, etat: 'ouvert', resultats: [3, 1], vote: 0 },
					photos: [7, 8],
					jaime: 2,
					commentaires: 1
				})
			]
		});
		expect(page).toContain('Événement');
		expect(page).toMatch(/role="img"[^>]*aria-label="jeudi 5 novembre"/);
		expect(page).toContain('19 h 30 · Caserne');
		expect(page).toContain('Équipe 2 (vous l’êtes)');
		expect(page).toContain('Oui : 3 voix, 75 % (votre choix)');
		expect(page).toContain('src="/echanges/photo/7"');
		expect(page).toContain('alt="Photo 2 sur 2, publiée par Alice Martin"');
		expect(page).toContain('2 j’aime · 1 commentaire');
	});

	it('gestes selon les droits', () => {
		const sans = html({ publications: [pub()] });
		expect(sans).not.toContain('?/epingler');
		expect(sans).not.toContain('?/supprimer');
		const tout = html({ publications: [pub({ droits: { modifier: true, supprimer: true, epingler: true, fermer: true } })] });
		expect(tout).toContain('action="?/epingler"');
		expect(tout).toContain('action="?/modifier"');
		expect(tout).toContain('Confirmer la suppression');
	});

	it('plus de formulaire en bas du mur : un lien « Publier dans <mur> », pour qui peut publier', () => {
		const page = html();
		expect(page).not.toContain('?/publier');
		expect(page).toMatch(/<a[^>]*href="\/echanges\/publier\?mur=vie"[^>]*>[\s\S]*Publier dans Vie du centre/);
		expect(html({ mur: { ...mur, cle: 'equipe:1', nom: 'Équipe 1', type: 'equipe' } })).toContain('href="/echanges/publier?mur=equipe%3A1"');
		expect(html({ mur: { ...mur, peutPublier: false, lectureSeule: true } })).not.toContain('/echanges/publier');
		expect(html({ mur: { ...mur, cle: 'centre', peutPublier: false } })).toContain('seuls ses modérateurs y publient');
	});

	it('la bande du mur : son nom, à quoi il sert et qui le voit, en texte', () => {
		const centre = html({ mur: { ...mur, cle: 'centre', nom: 'Le centre', type: 'centre' } });
		expect(centre).toMatch(/<h1[^>]*>Le centre<\/h1>/);
		expect(centre).toContain('Les infos officielles du chef et de l’adjoint');
		expect(centre).toContain('Visible par tous les agents du centre (38)');
		const equipe = html({ mur: { ...mur, cle: 'equipe:1', nom: 'Équipe 1', type: 'equipe' }, audience: 9 });
		expect(equipe).toContain('Visible par les 9 membres de l’équipe 1, le chef et l’adjoint');
		expect(equipe).toContain('#d4a017');
	});

	it('l’auteur : visage, nom et rôle ; le super administrateur s’affiche sans planter', () => {
		const chef = html({ publications: [pub({ auteur: { prenom: 'Claire', nom: 'Chef', couleur: '#0f4c8a', role: 'Chef de centre', ecrireA: null } })] });
		expect(chef).toMatch(/aria-hidden="true"[^>]*>CC</);
		expect(chef).toContain('Chef de centre');
		const sup = html({ publications: [pub({ auteur: { prenom: 'Super', nom: 'administrateur', couleur: null, role: null, ecrireA: null } })] });
		expect(sup).toContain('>SA<');
		expect(sup).toContain('Super administrateur');
	});

	it('refus affichés au bon endroit', () => {
		const refus = html({ publications: [pub(), pub({ id: 2 })] }, { cible: 'publication:1', message: 'Vous n’avez pas le droit de faire cela.' });
		expect(refus.match(/Vous n’avez pas le droit de faire cela\./g)).toHaveLength(2);
	});

	it('anniversaires du jour en tête, sans l’âge ; rien s’il n’y en a pas', () => {
		const vie = html({ anniversaires: [{ prenom: 'Alice', nom: 'Martin' }, { prenom: 'Bruno', nom: 'Petit' }, { prenom: 'Chloé', nom: 'Roux' }], epinglees: [pub({ epinglee: true })] });
		expect(vie).toContain('Bon anniversaire à Alice Martin, Bruno Petit et Chloé Roux !');
		expect(vie.indexOf('Bon anniversaire')).toBeLessThan(vie.indexOf('Épinglées'));
		expect(vie.indexOf('<h1')).toBeLessThan(vie.indexOf('Bon anniversaire'));
		expect(html({ anniversaires: [{ prenom: 'Alice', nom: 'Martin' }] })).toContain('Bon anniversaire à Alice Martin !');
		expect(html()).not.toContain('anniversaire');
	});

	it('une seule zone annoncée (status, alert) par page', () => {
		const page = html({ publications: [pub(), pub({ id: 2 })], epinglees: [pub({ id: 3 })] }, { cible: 'publication:2', succes: 'Publication épinglée.' });
		expect(page.match(/role="status"/g)).toHaveLength(1);
		expect(page.match(/role="alert"/g)).toHaveLength(1);
		expect(page).toMatch(/role="status">Publication épinglée\.</);
		expect(page).toMatch(/class="pages[^"]*sous-le-lien/);
	});
});

describe('gestes sur une publication', () => {
	const agir = (p: PublicationVue, data: Record<string, unknown> = {}) => html({ publications: [p], estPersonne: true, ...data });
	const commentaire = (id: number, texte: string) => ({ id, auteur: { prenom: 'Bruno', nom: 'Petit' }, texte, creeLe: '2026-10-28T15:00', supprimable: false });

	it('« J’aime » : bouton à bascule avec le nombre ; en texte pour qui ne peut pas agir', () => {
		const aime = agir(pub({ jaime: 3, jaimeParMoi: true }));
		expect(aime).toContain('action="?/aimer"');
		expect(aime).toMatch(/<button[^>]*aria-pressed="true"[^>]*>J’aime · <span[^>]*>3<\/span>/);
		expect(aime).toMatch(/name="oui" value="0"/);
		expect(agir(pub({ jaime: 0 }))).toMatch(/<button[^>]*aria-pressed="false"[^>]*>J’aime/);
		expect(html({ publications: [pub({ jaime: 2 })] })).not.toContain('?/aimer');
		expect(agir(pub({ jaime: 2 }), { mur: { ...mur, lectureSeule: true, peutPublier: false } })).not.toContain('?/aimer');
	});

	it('les 2 derniers commentaires, puis « Voir les N commentaires » ou « Commenter »', () => {
		const page = agir(pub({ commentaires: 5, derniersCommentaires: [commentaire(4, 'Quatre'), commentaire(5, 'Cinq')] }));
		expect(page).toContain('Quatre');
		expect(page).toContain('Bruno Petit');
		expect(page).toMatch(/href="\/echanges\/vie\/1"[^>]*>Voir les 5 commentaires/);
		expect(agir(pub({ commentaires: 1, derniersCommentaires: [commentaire(4, 'Seul')] }))).toMatch(/href="\/echanges\/vie\/1#commenter"[^>]*>Commenter/);
		const fermes = agir(pub({ commentairesFermes: true }));
		expect(fermes).not.toContain('>Commenter<');
		expect(fermes).toContain('commentaires fermés');
	});

	it('réponse à l’événement : trois boutons à bascule, pour les convoqués seulement ; comptes en texte', () => {
		const evenement = { debut: '2026-11-05T19:30', lieu: 'Caserne', convoques: 'tous' as const, convoque: true, reponse: 'incertain' as const, compte: { present: 2, absent: 0, incertain: 1 }, presents: [] };
		const page = agir(pub({ type: 'evenement', evenement }));
		expect(page).toContain('action="?/repondre"');
		for (const [valeur, libelle, appuye] of [['present', 'Présent', false], ['absent', 'Absent', false], ['incertain', 'Incertain', true]])
			expect(page).toMatch(new RegExp(`<button[^>]*name="reponse" value="${valeur}"[^>]*aria-pressed="${appuye}"[^>]*><span aria-hidden="true"[^>]*>[✓✕?]</span> ${libelle}<`));
		expect(page).toContain('2 présents · 0 absent · 1 incertain');
		// La réponse choisie porte une marque écrite, pas seulement une couleur ; elle seule.
		expect(page.match(/votre réponse</g)).toHaveLength(1);
		expect(page).toMatch(/value="incertain"[^>]*aria-pressed="true"[^>]*>[\s\S]*?Incertain[\s\S]*?votre réponse<[\s\S]*?<\/button>/);
		expect(page).not.toMatch(/aria-pressed="false"[^>]*>(?:(?!<\/button>)[\s\S])*votre réponse/);
		expect(agir(pub({ type: 'evenement', evenement: { ...evenement, reponse: null } }))).not.toContain('votre réponse<');
		expect(agir(pub({ type: 'evenement', evenement: { ...evenement, convoque: false } }))).not.toContain('?/repondre');
	});

	it('sondage : les choix, puis les résultats en nombre et en pourcentage (jamais la couleur seule)', () => {
		const sondage = { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ouverture: null, cloture: null, etat: 'ouvert' as const, resultats: [3, 1], vote: null };
		const avant = agir(pub({ sondage }));
		expect(avant).toContain('action="?/voter"');
		expect(avant).toMatch(/<button[^>]*name="reponse" value="0"[^>]*>Oui</);
		expect(avant).toContain('4 réponses');
		expect(avant).not.toContain('75 %');
		const apres = agir(pub({ sondage: { ...sondage, vote: 0 } }));
		expect(apres).toContain('Oui : 3 voix, 75 % (votre choix)');
		expect(apres).toContain('Non : 1 voix, 25 %');
		expect(apres).toMatch(/class="barre[^"]*" aria-hidden="true"/);
		expect(apres).toContain('Changer mon vote');
		// Sans pouvoir voter : les résultats.
		expect(html({ publications: [pub({ sondage })] })).toContain('Oui : 3 voix, 75 %');
		// Résultats non transmis (pas encore voté) : ni voix ni nombre de réponses.
		const cache = { ...sondage, resultats: null };
		expect(agir(pub({ sondage: cache }))).toContain('action="?/voter"');
		expect(agir(pub({ sondage: cache }))).not.toContain('0 réponse');
		const lecture = html({ publications: [pub({ sondage: cache })] });
		expect(lecture).toContain('Les résultats sont réservés à ceux qui ont voté.');
		expect(lecture).not.toContain('voix');
	});

	it('prise de connaissance : bouton, puis la date', () => {
		const avant = agir(pub({ type: 'annonce', priseDeConnaissance: { le: null, faites: 0, attendues: 3 } }));
		expect(avant).toContain('action="?/prendreConnaissance"');
		expect(avant).toContain('>J’ai pris connaissance<');
		const apres = agir(pub({ type: 'annonce', priseDeConnaissance: { le: '2026-10-28T14:30:00', faites: 1, attendues: 3 } }));
		expect(apres).not.toContain('?/prendreConnaissance');
		expect(apres).toContain('Vous avez pris connaissance le 28 octobre à 14:30.');
		// L’auteur n’a pas à prendre connaissance de son annonce ; il en voit le suivi.
		const auteur = agir(pub({ type: 'annonce', priseDeConnaissance: { le: null, faites: 0, attendues: 3 }, droits: { modifier: true, supprimer: true, epingler: false, fermer: true } }));
		expect(auteur).not.toContain('?/prendreConnaissance');
		expect(auteur).toMatch(/href="\/echanges\/vie\/1#suivi"[^>]*>Voir le suivi/);
	});

	it('fermer ou rouvrir les commentaires selon le droit', () => {
		const droits = { modifier: false, supprimer: true, epingler: true, fermer: true };
		expect(agir(pub({ droits }))).toMatch(/action="\?\/fermerCommentaires"[\s\S]*Fermer les commentaires/);
		expect(agir(pub({ droits, commentairesFermes: true }))).toContain('Rouvrir les commentaires');
		expect(agir(pub())).not.toContain('?/fermerCommentaires');
	});
});


describe('cartes par type', () => {
	const agir = (p: PublicationVue, niveau = 'equilibre') => html({ publications: [p], estPersonne: true }, null, niveau);

	it('annonce à confirmer : bandeau, barre et « 12 sur 38 ont confirmé », puis le bouton', () => {
		const page = agir(pub({ type: 'annonce', priseDeConnaissance: { le: null, faites: 12, attendues: 38 } }));
		expect(page).toContain('Annonce à lire et confirmer');
		expect(page).toContain('12 sur 38 ont confirmé');
		expect(page).toContain('>J’ai pris connaissance<');
		expect(agir(pub({ type: 'annonce', epinglee: true, priseDeConnaissance: { le: null, faites: 1, attendues: 38 } }))).toContain('Épinglée · Annonce à lire et confirmer');
		// Le verbe suit l'ensemble : « a » seulement quand une seule personne est attendue.
		const lu = (faites: number, attendues: number) => agir(pub({ type: 'annonce', priseDeConnaissance: { le: null, faites, attendues } }));
		expect(lu(0, 38)).toContain('0 sur 38 ont confirmé');
		expect(lu(1, 38)).toContain('1 sur 38 ont confirmé');
		expect(lu(0, 1)).toContain('0 sur 1 a confirmé');
		expect(lu(1, 1)).toContain('1 sur 1 a confirmé');
	});

	it('événement : la tuile date, les présents et trois boutons avec leur mot', () => {
		const presents = [
			{ prenom: 'Tom', nom: 'Agent', couleur: '#d4a017' },
			{ prenom: 'Rémi', nom: 'Roux', couleur: null }
		];
		const evenement = { debut: '2026-11-05T19:00', lieu: 'Plateforme du centre', convoques: 'tous' as const, convoque: true, reponse: null, compte: { present: 14, absent: 3, incertain: 2 }, presents };
		const page = agir(pub({ type: 'evenement', evenement }));
		expect(page).toMatch(/role="img"[^>]*aria-label="jeudi 5 novembre"/);
		expect(page).toContain('19 h · Plateforme du centre');
		expect(page).toContain('14 présents · 3 absents · 2 incertains');
		expect(page).toContain('>TA<');
		for (const mot of ['Présent', 'Absent', 'Incertain']) expect(page).toMatch(new RegExp(`aria-pressed="false"[^>]*><span aria-hidden="true"[^>]*>[^<]+</span> ${mot}<`));
	});

	it('bravo : « Applaudir » à la place de « J’aime » ; Gyro en victoire et confettis selon le niveau', () => {
		const bravo = pub({ type: 'bravo', jaime: 12 });
		const page = agir(bravo);
		expect(page).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Applaudir · <span[^>]*>12<\/span>/);
		expect(page).not.toContain('J’aime');
		expect(page).toContain('Bravo !');
		expect(page).toContain('class="gyro');
		expect(page).toContain('class="confettis');
		const sobre = agir(bravo, 'sobre');
		expect(sobre).not.toContain('class="gyro');
		expect(sobre).not.toContain('class="confettis');
		expect(sobre).toContain('Applaudir');
		expect(html({ publications: [bravo] })).toContain('12 applaudissements');
		expect(agir(pub({ jaime: 1 }))).not.toContain('Applaudir');
	});

	it('Vivant : seul le premier bravo anime Gyro, une fois', () => {
		const page = agir(pub({ type: 'bravo' }), 'vivant');
		expect(page).toContain('a-saute');
		const deux = html({ publications: [pub({ id: 1, type: 'bravo' }), pub({ id: 2, type: 'bravo' })], estPersonne: true }, null, 'vivant');
		expect(deux.match(/a-saute/g)?.length).toBe(page.match(/a-saute/g)?.length);
		expect(deux.indexOf('a-saute')).toBeGreaterThan(-1);
		expect(deux.indexOf('a-saute')).toBeLessThan(deux.indexOf('id="publication-2"'));
		expect(agir(pub({ type: 'bravo' }), 'equilibre')).not.toContain('a-saute');
	});

	it('« Répondre en privé » à l’auteur, avec le début de la publication ; seulement si l’on a la messagerie et qu’on peut lui écrire', () => {
		const texte = `Qui peut me remplacer samedi ? ${'x'.repeat(200)}`;
		const avec = html({ messagerie: true, publications: [pub({ texte, auteur: { prenom: 'Alice', nom: 'Martin', couleur: null, role: null, ecrireA: 5 } })] });
		const lien = /<a[^>]*href="([^"]*)"[^>]*>Répondre en privé<\/a>/.exec(avec);
		expect(lien).not.toBeNull();
		expect(lien![0]).toContain('aria-label="Répondre en privé à Alice Martin"');
		const url = new URL(lien![1]!.replaceAll('&amp;', '&'), 'http://x');
		expect(url.pathname).toBe('/echanges/messages/a/5');
		expect(url.searchParams.get('apropos')).toBe(texte.slice(0, 120));
		expect(html({ messagerie: false, publications: [pub({ auteur: { prenom: 'Alice', nom: 'Martin', couleur: null, role: null, ecrireA: 5 } })] })).not.toContain('Répondre en privé');
		expect(html({ messagerie: true, publications: [pub()] })).not.toContain('Répondre en privé');
	});

	it('« Répondre en privé » : un emoji pile à la limite ne casse pas le mur', () => {
		const texte = `${'a'.repeat(119)}🚒 et la suite`;
		const page = html({ messagerie: true, publications: [pub({ texte, auteur: { prenom: 'Alice', nom: 'Martin', couleur: null, role: null, ecrireA: 5 } })] });
		const lien = /<a[^>]*href="([^"]*)"[^>]*>Répondre en privé<\/a>/.exec(page)!;
		expect(new URL(lien[1]!.replaceAll('&amp;', '&'), 'http://x').searchParams.get('apropos')).toBe(`${'a'.repeat(119)}🚒`);
	});
});

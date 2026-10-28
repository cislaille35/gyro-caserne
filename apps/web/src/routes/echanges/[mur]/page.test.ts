import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { PublicationVue } from '@gyro-caserne/socle';
import Page from './+page.svelte';

const pub = (p: Partial<PublicationVue> = {}): PublicationVue => ({
	id: 1,
	cle: 'vie',
	auteur: { prenom: 'Alice', nom: 'Martin' },
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
const html = (data: Record<string, unknown> = {}, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, { props: { data: { mur, epinglees: [], publications: [], suite: null, equipes, plusAnciennes: false, ...data }, form } }).body;

describe('page d’un mur', () => {
	it('le texte n’est jamais interprété comme du HTML', () => {
		const page = html({ publications: [pub({ texte: '<img src=x onerror=alert(1)>\nLigne 2' })] });
		expect(page).not.toContain('<img src=x');
		expect(page).toContain('&lt;img src=x onerror=alert(1)>\nLigne 2');
	});

	it('épinglées puis publications, auteur et date, « Voir plus »', () => {
		const page = html({ epinglees: [pub({ id: 9, texte: 'Épinglée', epinglee: true })], publications: [pub()], suite: 1 });
		expect(page.indexOf('Épinglée')).toBeLessThan(page.indexOf('Bonjour'));
		expect(page).toContain('Alice Martin');
		expect(page).toContain('le 28 octobre à 14:05');
		expect(page).toContain('href="?avant=1"');
		expect(page).not.toContain('Revenir aux plus récentes');
		expect(html({ plusAnciennes: true })).toContain('Revenir aux plus récentes');
	});

	it('montre l’événement, le sondage, les photos privées et les comptes, en texte', () => {
		const page = html({
			publications: [
				pub({
					type: 'evenement',
					evenement: { debut: '2026-11-05T19:30', lieu: 'Caserne', convoques: [2], convoque: true, reponse: null, compte: { present: 0, absent: 0, incertain: 0 } },
					sondage: { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], resultats: [3, 1], vote: 0 },
					photos: [7, 8],
					jaime: 2,
					commentaires: 1
				})
			]
		});
		expect(page).toContain('Événement');
		expect(page).toContain('jeudi 5 novembre à 19:30');
		expect(page).toContain('Équipe 2 (vous l’êtes)');
		expect(page).toContain('Oui : 3 voix (votre choix)');
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

	it('formulaire « Publier » : tous les types, photos en plusieurs parties ; prise de connaissance pour les modérateurs', () => {
		const page = html();
		expect(page).toMatch(/action="\?\/publier" enctype="multipart\/form-data"/);
		for (const type of ['Message', 'Annonce', 'Événement', 'Bravo']) expect(page).toContain(`>${type}</option>`);
		expect(page).toContain('name="debut"');
		expect(page).toContain('name="equipe" value="2"');
		expect(page).not.toContain('name="equipe" value="3"');
		expect(page).toContain('name="photos"');
		expect(page).toContain('href="#publier"');
		expect(page).not.toContain('priseDeConnaissance');
		expect(html({ mur: { ...mur, cle: 'centre', type: 'centre', peutModerer: true } })).toContain('name="priseDeConnaissance"');
	});

	it('pas de formulaire sans droit de publier', () => {
		expect(html({ mur: { ...mur, peutPublier: false, lectureSeule: true } })).not.toContain('?/publier');
		expect(html({ mur: { ...mur, cle: 'centre', peutPublier: false } })).toContain('seuls ses modérateurs y publient');
	});

	it('refus affichés au bon endroit, saisie gardée', () => {
		const page = html({ publications: [pub()] }, { cible: 'publier', erreurs: { texte: 'Écrivez le texte de la publication.', photos: 'Photo trop lourde : 400 Ko au plus.' }, valeurs: { type: 'message', lieu: 'Salle' } });
		expect(page).toContain('La publication contient des erreurs.');
		expect(page).toContain('Écrivez le texte de la publication.');
		expect(page).toContain('Photo trop lourde : 400 Ko au plus.');
		expect(page).toContain('value="Salle"');
		const refus = html({ publications: [pub(), pub({ id: 2 })] }, { cible: 'publication:1', message: 'Vous n’avez pas le droit de faire cela.' });
		expect(refus.match(/Vous n’avez pas le droit de faire cela\./g)).toHaveLength(2);
	});

	it('une seule zone annoncée (status, alert) par page', () => {
		const page = html({ publications: [pub(), pub({ id: 2 })], epinglees: [pub({ id: 3 })] }, { cible: 'publication:2', succes: 'Publication épinglée.' });
		expect(page.match(/role="status"/g)).toHaveLength(1);
		expect(page.match(/role="alert"/g)).toHaveLength(1);
		expect(page).toMatch(/role="status">Publication épinglée\.</);
		expect(page).toMatch(/class="pages[^"]*sous-le-lien/);
	});
});

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page@.svelte';

const vie = { cle: 'vie', nom: 'Vie du centre', type: 'vie', peutModerer: false, audience: 38, icone: 'ballon', couleur: null, numero: null };
const equipe1 = { cle: 'equipe:1', nom: 'Équipe 1', type: 'equipe', peutModerer: false, audience: 9, icone: null, couleur: '#d4a017', numero: 1 };
const centre = { cle: 'centre', nom: 'Le centre', type: 'centre', peutModerer: true, audience: 38, icone: 'maison', couleur: null, numero: null };
const equipes = [
	{ id: 1, nom: 'Équipe 1', active: 1 },
	{ id: 2, nom: 'Équipe 2', active: 1 },
	{ id: 3, nom: 'Équipe 3', active: 0 }
];
const html = (data: Record<string, unknown> = {}, form: unknown = null) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	render(Page as any, {
		props: { data: { murs: [equipe1, vie], choisi: null, texte: '', ouverture: '2026-10-29T12:00', cloture: '2026-11-05T12:00', equipes, ...data }, form },
		context: new Map([['affichage', { niveau: 'equilibre', theme: 'auto' }]])
	}).body;
const radio = (page: string, name: string, value: string) => page.match(new RegExp(`<input[^>]*name="${name}"[^>]*value="${value}"[^>]*>`))?.[0] ?? '';

describe('page Publier', () => {
	it('un choix par mur proposé, la phrase « Visible par » sous chacun (sans JavaScript)', () => {
		const page = html();
		expect(page).toMatch(/<h1 id="titre-publier" tabindex="-1"[^>]*>Nouvelle publication<\/h1>/);
		expect(page).toContain('Où publier ?');
		expect(radio(page, 'mur', 'equipe:1')).toMatch(/type="radio"[^>]*required/);
		expect(radio(page, 'mur', 'vie')).not.toContain('checked');
		// Même phrase, point compris, qu'avec JavaScript.
		expect(page).toContain('Visible par les 9 membres de l’équipe 1, le chef et l’adjoint.');
		expect(page).toContain('Visible par tous les agents du centre (38).');
		expect(page).toMatch(/<a[^>]*href="\/echanges"[^>]*>Annuler<\/a>/);
	});

	it('le mur choisi d’avance est coché, et « Annuler » y ramène ; le texte est prérempli', () => {
		const page = html({ choisi: 'equipe:1', texte: 'Joyeux anniversaire Alice !' });
		expect(radio(page, 'mur', 'equipe:1')).toContain('checked');
		expect(page).toMatch(/<a[^>]*href="\/echanges\/equipe%3A1"[^>]*>Annuler<\/a>/);
		expect(page).toMatch(/<textarea[^>]*name="texte"[^>]*>Joyeux anniversaire Alice !<\/textarea>/);
	});

	it('le genre en 4 tuiles pour tous ; la prise de connaissance seulement si l’on modère un des murs', () => {
		const sans = html();
		const genres = (page: string) => [...page.matchAll(/name="type"[^>]*value="(\w+)"/g)].map((m) => m[1]);
		expect(genres(sans)).toEqual(['message', 'evenement', 'bravo', 'annonce']);
		expect(radio(sans, 'type', 'message')).toContain('checked');
		expect(sans).not.toContain('priseDeConnaissance');
		expect(sans).not.toContain('réservé aux modérateurs du mur');
		const avec = html({ murs: [centre, vie] });
		expect(avec).toContain('name="priseDeConnaissance"');
		// Sans JavaScript, la case reste visible avec sa mention.
		expect(avec).toMatch(/Demander une prise de connaissance[\s\S]*réservé aux modérateurs du mur/);
	});

	it('envoi en plusieurs parties (photos) ; seules les équipes actives se convoquent', () => {
		const page = html();
		expect(page).toMatch(/action="\?\/publier" enctype="multipart\/form-data"/);
		expect(page).toContain('name="photos"');
		expect(page).toContain('name="debut"');
		expect(page).toContain('name="equipe" value="2"');
		expect(page).not.toContain('name="equipe" value="3"');
	});

	it('sans JavaScript, le bouton dit « Publier »', () => {
		expect(html({ choisi: 'vie' })).toMatch(/<button[^>]*type="submit"[^>]*>\s*Publier\s*<\/button>/);
	});

	it('sondage : ouverture et clôture préremplies ; pour un événement, la clôture suit son début', () => {
		const page = html();
		expect(page).toMatch(/<input[^>]*name="ouverture"[^>]*value="2026-10-29T12:00"/);
		expect(page).toMatch(/<input[^>]*name="cloture"[^>]*value="2026-11-05T12:00"/);
		expect(page).toMatch(/<input[^>]*type="datetime-local"[^>]*name="cloture"|<input[^>]*name="cloture"[^>]*type="datetime-local"/);
		const evenement = html({}, { cible: 'publier', erreurs: { lieu: 'Indiquez le lieu.' }, valeurs: { mur: 'vie', type: 'evenement', debut: '2026-11-01T19:30' } });
		expect(evenement).toMatch(/<input[^>]*name="cloture"[^>]*value="2026-11-01T19:30"/);
		// Un événement lointain : la clôture s'arrête un an après l'ouverture.
		const lointain = html({}, { cible: 'publier', erreurs: { lieu: 'Indiquez le lieu.' }, valeurs: { mur: 'vie', type: 'evenement', debut: '2099-06-01T18:30', ouverture: '2026-10-29T12:00' } });
		expect(lointain).toMatch(/<input[^>]*name="cloture"[^>]*value="2027-10-29T12:00"/);
		const illisible = html({}, { cible: 'publier', erreurs: { ouverture: 'Indiquez une date et une heure d’ouverture valides.' }, valeurs: { mur: 'vie', ouverture: 'demain' } });
		expect(illisible).toMatch(/<input[^>]*name="cloture"[^>]*value="2026-11-05T12:00"/);
		expect(radio(evenement, 'mur', 'vie')).toContain('checked');
		expect(radio(evenement, 'type', 'evenement')).toContain('checked');
	});

	it('refus : chaque erreur reliée à son champ, sondage ouvert, saisie gardée', () => {
		const relie = (page: string, nom: string, message: string) => {
			const champ = page.match(new RegExp(`<input[^>]*name="${nom}"[^>]*>`))?.[0] ?? '';
			expect(champ, nom).toContain('aria-invalid="true"');
			const id = champ.match(/aria-describedby="([^"]+)"/)![1]!.split(' ').at(-1);
			expect(page, nom).toMatch(new RegExp(`id="${id}"[^>]*>${message}<`));
		};
		const valeurs = { mur: 'vie', type: 'message', texte: 'Bonjour', question: 'Q ?', ouverture: '2026-10-29T12:00', cloture: '2026-10-29T12:00' };
		const cloture = html({}, { cible: 'publier', erreurs: { cloture: 'Le sondage doit se clore après son ouverture.' }, valeurs });
		expect(cloture).toContain('La publication contient des erreurs.');
		expect(cloture).toMatch(/<details[^>]*open/);
		relie(cloture, 'cloture', 'Le sondage doit se clore après son ouverture.');
		expect(cloture).not.toMatch(/<input[^>]*name="(ouverture|question)"[^>]*aria-invalid/);
		expect(cloture).toMatch(/<input[^>]*name="cloture"[^>]*value="2026-10-29T12:00"/);
		expect(cloture).toMatch(/<textarea[^>]*>Bonjour<\/textarea>/);
		relie(html({}, { cible: 'publier', erreurs: { ouverture: 'Indiquez une date et une heure d’ouverture valides.' }, valeurs }), 'ouverture', 'Indiquez une date et une heure d’ouverture valides.');
		relie(html({}, { cible: 'publier', erreurs: { sondage: 'Proposez de 2 à 6 réponses.' }, valeurs }), 'question', 'Proposez de 2 à 6 réponses.');
		relie(html({ murs: [centre, vie] }, { cible: 'publier', erreurs: { priseDeConnaissance: 'Seuls les modérateurs du mur demandent une prise de connaissance.' }, valeurs: { ...valeurs, type: 'annonce' } }), 'priseDeConnaissance', 'Seuls les modérateurs du mur demandent une prise de connaissance.');
		const mur = html({}, { cible: 'publier', erreurs: { mur: 'Choisissez où publier.' }, valeurs: {} });
		expect(mur).toMatch(/<fieldset[^>]*aria-describedby="publier-mur-erreur"/);
		expect(mur).toMatch(/id="publier-mur-erreur"[^>]*>Choisissez où publier\.</);
		const type = html({}, { cible: 'publier', erreurs: { type: 'Choisissez le type de publication.' }, valeurs: {} });
		expect(type).toMatch(/<fieldset[^>]*aria-describedby="publier-type-erreur"/);
		expect(type).toMatch(/id="publier-type-erreur"[^>]*>Choisissez le type de publication\.</);
	});

	it('aucun mur où publier : une phrase, pas de formulaire', () => {
		const page = html({ murs: [] });
		expect(page).toContain('Vous ne pouvez publier sur aucun mur.');
		expect(page).not.toContain('<form');
	});
});

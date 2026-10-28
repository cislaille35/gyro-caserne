import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const fiche = {
	id: 3,
	email: 'alice@exemple.fr',
	prenom: 'Alice',
	nom: 'Martin',
	surnom: null,
	telephone: null,
	telephoneVisible: 0,
	naissance: '1990-05-01',
	anniversaireVisible: 1,
	entreeCentre: null,
	engagementSpv: null,
	dateGrade: null,
	statut: 'operationnel',
	contactUrgence: null,
	creeLe: '2026-01-01',
	equipe: null,
	grade: null,
	profil: { id: 1, nom: 'Agent' },
	protection: null
};
const aucun = { enCours: [], aVenir: [], passees: [] };
const data = { aujourdhui: '2026-10-27', attributions: aucun, peutAttribuer: [], fiche, raison: null, grades: [], profils: [{ id: 1, nom: 'Agent' }], equipes: [{ id: 1, nom: 'Équipe 1' }], statuts: ['operationnel', 'suspendu', 'parti'] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;
// Le bouton d'un bloc (Groupe) : titre et résumé y sont écrits.
const bloc = (page: string, titre: string) => page.match(new RegExp(`<button[^>]*aria-expanded="(true|false)"[^>]*>(?:(?!</button>)[\\s\\S])*class="titre[^"]*">${titre}<(?:(?!</button>)[\\s\\S])*</button>`))!;
const ouvert = (page: string, titre: string) => bloc(page, titre)[1] === 'true';
const BLOCS = ['Identité et contact', 'Parcours', 'Équipe et statut', 'Rôles', 'Départ du centre'];

describe('page fiche agent', () => {
	describe('en-tête', () => {
		const role = (id: number, nom: string, icone: string) => ({ id, responsabilite: { id, nom, icone }, perimetre: { type: 'centre', id: null, nom: null }, debut: '2026-01-01', fin: null, saisiePar: 'Chef Test', peutTerminer: true });

		it('initiales, nom en titre de page, grade, équipe, statut et rôles en cours avec leur icône', () => {
			const complete = { ...fiche, grade: { id: 2, libelle: 'Caporal-chef' }, equipe: { id: 1, nom: 'Équipe 1', couleur: '#b3121f' } };
			const attributions = { enCours: [role(1, 'Référent engins', 'camion')], aVenir: [role(2, 'Référent pharmacie', 'croix')], passees: [] };
			const page = html({ data: { ...data, fiche: complete, attributions }, form: null });
			const entete = page.slice(page.indexOf('<header'), page.indexOf('</header>'));
			expect(entete).toMatch(/aria-hidden="true"[^>]*>AM</);
			expect(entete).toMatch(/<h1[^>]*>Alice Martin<\/h1>/);
			expect(entete).toContain('Caporal-chef · Équipe 1');
			expect(entete).toContain('Opérationnel');
			expect(entete).toContain('Référent engins');
			expect(entete).toMatch(/<svg[\s\S]*Référent engins/);
			expect(entete).not.toContain('Référent pharmacie');
			expect(page.match(/<h1/g)).toHaveLength(1);
		});

		it('« Écrire » ouvre la messagerie de l’appareil ; pas de lien « Appeler » sans téléphone', () => {
			const page = html({ data, form: null });
			expect(page).toMatch(/<a[^>]*href="mailto:alice@exemple\.fr"[^>]*>(<!--[^>]*-->)*Écrire/);
			expect(page).not.toContain('tel:');
			expect(page).not.toContain('Appeler');
		});

		it('« Appeler » compose le numéro quand il existe', () => {
			const page = html({ data: { ...data, fiche: { ...fiche, telephone: '06 12 34 56 78' } }, form: null });
			expect(page).toMatch(/<a[^>]*href="tel:0612345678"[^>]*>(<!--[^>]*-->)*Appeler/);
		});
	});

	describe('blocs', () => {
		it('cinq blocs fermés, chacun avec son résumé', () => {
			const page = html({ data, form: null });
			for (const titre of BLOCS) expect(ouvert(page, titre)).toBe(false);
			expect(bloc(page, 'Identité et contact')[0]).toContain('alice@exemple.fr');
			expect(bloc(page, 'Parcours')[0]).toContain('Aucun grade');
			expect(bloc(page, 'Équipe et statut')[0]).toContain('Aucune équipe · Opérationnel');
			expect(bloc(page, 'Rôles')[0]).toContain('Aucun rôle en cours');
			expect(bloc(page, 'Départ du centre')[0]).toContain('Fin des rôles, données personnelles effacées');
		});

		it('les résumés disent le téléphone, le grade et l’entrée, les rôles en cours', () => {
			const complete = { ...fiche, telephone: '06 12 34 56 78', grade: { id: 2, libelle: 'Caporal-chef' }, entreeCentre: '2015-09-01' };
			const attributions = { enCours: [{ id: 1, responsabilite: { id: 1, nom: 'Référent engins', icone: 'camion' }, perimetre: { type: 'centre', id: null, nom: null }, debut: '2026-01-01', fin: null, saisiePar: 'x', peutTerminer: true }], aVenir: [], passees: [] };
			const page = html({ data: { ...data, fiche: complete, attributions }, form: null });
			expect(bloc(page, 'Identité et contact')[0]).toContain('alice@exemple.fr · 06 12 34 56 78');
			expect(bloc(page, 'Parcours')[0]).toContain('Caporal-chef · au centre depuis 2015');
			expect(bloc(page, 'Rôles')[0]).toContain('Référent engins');
		});

		it('une erreur sur l’e-mail ouvre « Identité et contact », et lui seul', () => {
			const page = html({ data, form: { erreurs: { email: 'Adresse déjà utilisée' }, valeurs: { email: 'bob@exemple.fr' } } });
			expect(ouvert(page, 'Identité et contact')).toBe(true);
			for (const titre of BLOCS.slice(1)) expect(ouvert(page, titre)).toBe(false);
			expect(page).toContain('Adresse déjà utilisée');
		});

		it('chaque erreur ouvre le bloc de son champ', () => {
			expect(ouvert(html({ data, form: { erreurs: { dateGrade: 'x' } } }), 'Parcours')).toBe(true);
			// Un refus sans champ fautif ouvre le bloc du formulaire envoyé.
			expect(ouvert(html({ data, form: { message: 'Refusé', valeurs: { gradeId: '2', dateGrade: '' } } }), 'Parcours')).toBe(true);
			expect(ouvert(html({ data, form: { message: 'Refusé', valeurs: { prenom: 'Alice' } } }), 'Identité et contact')).toBe(true);
			expect(ouvert(html({ data, form: { erreurs: { equipeId: 'x' } } }), 'Équipe et statut')).toBe(true);
			expect(ouvert(html({ data, form: { erreurs: { statut: 'x' }, valeurs: { statut: 'z' } } }), 'Équipe et statut')).toBe(true);
			expect(ouvert(html({ data, form: { cible: 'terminer-2', erreurs: { confirmation: 'x' } } }), 'Rôles')).toBe(true);
			expect(ouvert(html({ data, form: { cible: 'terminer-2', erreurs: { confirmation: 'x' } } }), 'Départ du centre')).toBe(false);
		});

		it('un message pour les rôles (réussite comprise) garde « Rôles » ouvert', () => {
			expect(ouvert(html({ data, form: { cible: 'attribuer', succes: true, message: 'Rôle attribué' } }), 'Rôles')).toBe(true);
		});

		it('après un enregistrement réussi, le bloc enregistré reste ouvert', () => {
			for (const [bloc, titre] of [['identite', 'Identité et contact'], ['parcours', 'Parcours'], ['equipe', 'Équipe et statut'], ['depart', 'Départ du centre']]) {
				const page = html({ data, form: { succes: true, message: 'Enregistré', bloc } });
				for (const autre of BLOCS) expect(ouvert(page, autre)).toBe(autre === titre);
			}
		});

		it('un refus du socle sur l’équipe ouvre « Équipe et statut »', () => {
			const page = html({ data, form: { message: 'Seul un super administrateur change l’équipe du chef de centre', valeurs: { equipeId: '1' } } });
			expect(ouvert(page, 'Équipe et statut')).toBe(true);
		});

		it('sans JavaScript, les blocs restent ouverts', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(render(Page as any, { props: { data, form: null } }).head).toMatch(/<noscript><style>[^<]*\.groupe > \[hidden\][^<]*display: block/);
		});
	});

	it('montre les formulaires de la fiche, de l’équipe et du statut, avec chacun « Enregistrer »', () => {
		const page = html({ data, form: null });
		expect(page.match(/>Enregistrer</g)).toHaveLength(4);
		expect(page).toContain('action="?/fiche"');
		expect(page).toContain('action="?/equipe"');
		expect(page).toMatch(/action="\?\/statut"/);
	});

	it('le statut « Parti » se déclare dans « Départ du centre », pas dans la liste des statuts', () => {
		const page = html({ data, form: null });
		const statut = page.match(/<select[^>]*name="statut"[\s\S]*?<\/select>/)![0];
		expect(statut).not.toContain('value="parti"');
		const depart = page.slice(page.indexOf('>Départ du centre<'));
		expect(depart).toMatch(/<input[^>]*type="hidden"[^>]*name="statut"[^>]*value="parti"/);
		expect(depart).toContain("Sa date de naissance et son contact d'urgence seront effacés, et ses rôles prendront fin aujourd'hui.");
		expect(depart).toMatch(/<input[^>]*type="checkbox"[^>]*name="confirmation"[^>]*value="oui"/);
		expect(depart).toMatch(/>(<!--[^>]*-->)*Déclarer le départ</);
	});

	it('sans « Je confirme », « Départ du centre » s’ouvre avec l’erreur reliée à la case', () => {
		const page = html({ data, form: { erreurs: { confirmation: 'Cochez « Je confirme » pour déclarer le départ.' }, valeurs: { statut: 'parti' } } });
		expect(ouvert(page, 'Départ du centre')).toBe(true);
		expect(ouvert(page, 'Équipe et statut')).toBe(false);
		expect(page).toContain('Cochez « Je confirme » pour déclarer le départ.');
		expect(page).toMatch(/aria-describedby="depart-avertissement confirmation-erreur"/);
	});

	it('un agent parti : plus de formulaire de départ ; pour le réintégrer, on choisit un statut (« Parti » n’est pas proposé)', () => {
		const page = html({ data: { ...data, fiche: { ...fiche, statut: 'parti' } }, form: null });
		expect(page).not.toContain('Déclarer le départ');
		expect(bloc(page, 'Départ du centre')[0]).toContain('A quitté le centre');
		const statut = page.match(/<select[^>]*name="statut"[\s\S]*?<\/select>/)![0];
		expect(statut).not.toContain('value="parti"');
		expect(statut).toMatch(/<option[^>]*value=""[^>]*selected[^>]*>À choisir|<option[^>]*selected[^>]*value=""[^>]*>À choisir/);
	});

	it('un agent parti : une erreur de départ s’affiche quand même dans son bloc', () => {
		const page = html({ data: { ...data, fiche: { ...fiche, statut: 'parti' } }, form: { erreurs: { confirmation: 'Cochez « Je confirme » pour déclarer le départ.' }, valeurs: { statut: 'parti' } } });
		expect(ouvert(page, 'Départ du centre')).toBe(true);
		expect(page.slice(page.indexOf('>Départ du centre<'))).toContain('Cochez « Je confirme » pour déclarer le départ.');
	});

	it('remplace les formulaires par la raison quand la fiche est protégée', () => {
		const raison = 'Seul un super administrateur modifie la fiche du chef de centre.';
		const page = html({ data: { ...data, raison }, form: null });
		// Dans quatre blocs, et en résumé du départ (rien ne s'y déclare).
		expect(page.split(raison)).toHaveLength(6);
		expect(bloc(page, 'Départ du centre')[0]).toContain(raison);
		expect(page).not.toContain('Fin des rôles, données personnelles effacées');
		expect(page).not.toContain('<form');
		expect(page).not.toContain('<input');
		expect(page).not.toContain('<select');
	});

	it('signale dans l\'alerte un envoi qui n\'a que des erreurs de champ', () => {
		const page = html({ data, form: { erreurs: { prenom: 'Indiquez le prénom.' }, valeurs: { prenom: '' } } });
		expect(page).toMatch(/role="alert"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le formulaire contient des erreurs\.</);
		expect(page).toContain('Indiquez le prénom.');
	});

	it('affiche l\'erreur d\'équipe sous le nom du champ envoyé', () => {
		const page = html({ data, form: { erreurs: { equipeId: 'Équipe inconnue' } } });
		expect(page).toMatch(/<select[^>]*name="equipeId"/);
		expect(page).toContain('Équipe inconnue');
	});

	it('annonce le succès dans une zone de statut', () => {
		expect(html({ data, form: { succes: true, message: 'Fiche enregistrée' } })).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Fiche enregistrée</);
	});

	describe('bloc Rôles', () => {
		const ligne = (id: number, nom: string, peutTerminer: boolean, perimetre: { type: string; id: number | null; nom: string | null } = { type: 'centre', id: null, nom: null }) => ({
			id,
			responsabilite: { id: 1, nom, icone: 'outil' },
			perimetre,
			debut: '2026-01-01',
			fin: null,
			saisiePar: 'Chef Test',
			peutTerminer
		});
		const attributions = {
			enCours: [ligne(1, 'Référent engins', true), ligne(2, 'Chef d’équipe', false, { type: 'equipe', id: 1, nom: 'Équipe 1' })],
			aVenir: [ligne(3, 'Référent pharmacie', true)],
			passees: [ligne(4, 'Membre de comité', false, { type: 'comite', id: 2, nom: 'Amicale' })]
		};
		const peutAttribuer = [
			{ responsabiliteId: 5, nom: 'Référent engins', portee: 'centre', perimetres: [{ type: 'centre', id: null, nom: 'Centre' }] },
			{ responsabiliteId: 6, nom: 'Chef d’équipe', portee: 'equipe', perimetres: [{ type: 'equipe', id: 1, nom: 'Équipe 1' }] }
		];

		it('affiche les trois listes, la passée repliée, et « Terminer » seulement si permis', () => {
			const page = html({ data: { ...data, attributions, peutAttribuer: [] }, form: null });
			for (const titre of ['En cours', 'À venir', 'Passées']) expect(page).toContain(titre);
			expect(page).toContain('Référent engins');
			expect(page).toContain('Chef d’équipe — Équipe 1');
			expect(page).toMatch(/<details(?![^>]*open)[^>]*>(<!--[^>]*-->)*\s*<summary[^>]*>Passées/);
			expect(page.match(/action="\?\/terminer"/g)).toHaveLength(2);
			expect(page.match(/name="attributionId"/g)).toHaveLength(4);
		});

		it('ne montre « Terminer » que pour les rôles qu\'on peut retirer, et relie l\'erreur de confirmation à sa case', () => {
			const seul = { enCours: [ligne(1, 'Référent engins', false), ligne(2, 'Référent pharmacie', true)], aVenir: [], passees: [] };
			const page = html({ data: { ...data, attributions: seul }, form: { cible: 'terminer-2', erreurs: { confirmation: 'Cochez « Je confirme » pour terminer ce rôle.' } } });
			expect(page.match(/>Terminer</g)).toHaveLength(1);
			expect(page).toMatch(/role="alert"[^>]*>Cochez « Je confirme » pour terminer ce rôle\./);
			expect(page).toMatch(/aria-describedby="terminer-2-erreur"/);
		});

		it('annonce « Rôle terminé » dans la carte, même quand le rôle a quitté la liste', () => {
			const page = html({ data: { ...data, attributions: aucun }, form: { cible: 'terminer-2', succes: true, message: 'Rôle terminé' } });
			expect(page).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Rôle terminé</);
		});

		it('garde les messages à cible hors des bandeaux généraux et des champs de la fiche', () => {
			const page = html({ data, form: { cible: 'terminer-2', erreurs: { confirmation: 'Cochez' } } });
			expect(page).not.toContain('Le formulaire contient des erreurs.');
			expect(page).not.toContain('confirmation-erreur');
		});

		it('ne réaffiche pas un périmètre saisi pour une autre responsabilité', () => {
			const form = { cible: 'attribuer', erreurs: { debut: 'x' }, valeurs: { responsabiliteId: '6', perimetre: '99', debut: '2026-02-01', fin: '' } };
			const page = html({ data: { ...data, peutAttribuer }, form });
			expect(page).toMatch(/<option[^>]*value="1"[^>]*selected|<option[^>]*selected[^>]*value="1"/);
			expect(page).not.toContain('value="99"');
		});

		it('propose le formulaire d\'attribution seulement s\'il y a quelque chose à attribuer', () => {
			expect(html({ data, form: null })).not.toContain('action="?/attribuer"');
			const page = html({ data: { ...data, peutAttribuer }, form: null });
			expect(page).toContain('action="?/attribuer"');
			expect(page).toMatch(/<select[^>]*name="responsabiliteId"/);
			expect(page).toMatch(/<input[^>]*type="date"[^>]*name="debut"|<input[^>]*name="debut"[^>]*type="date"/);
			expect(page).toMatch(/name="fin"/);
		});

		it('montre l\'erreur de doublon sous la date de début et un message pour la bonne cible', () => {
			const form = { cible: 'attribuer', erreurs: { debut: 'Cette personne tient déjà ce rôle sur cette période' }, valeurs: { responsabiliteId: '5', perimetre: 'centre', debut: '2026-02-01', fin: '' } };
			const page = html({ data: { ...data, peutAttribuer }, form });
			expect(page).toContain('Cette personne tient déjà ce rôle sur cette période');
		});

		it('désactive le bouton pendant l\'envoi (bouton actif au départ)', () => {
			const page = html({ data: { ...data, peutAttribuer }, form: null });
			const bouton = page.match(/<button[^>]*>(<!--[^>]*-->)*Attribuer/);
			expect(bouton).not.toBeNull();
			expect(bouton![0]).not.toContain('disabled');
		});

		it('propose « Changer la date de fin » pour les rôles en cours et à venir qu\'on peut retirer', () => {
			const page = html({ data: { ...data, attributions }, form: null });
			expect(page.match(/action="\?\/finir"/g)).toHaveLength(2);
			expect(page.match(/>Changer la date de fin</g)).toHaveLength(2);
			expect(page).toMatch(/<input[^>]*id="nouvelle-fin-1"[^>]*type="date"|<input[^>]*type="date"[^>]*id="nouvelle-fin-1"/);
		});

		it('affiche l\'erreur de date de fin sous son champ, et annonce le succès dans la carte', () => {
			const erreur = html({ data: { ...data, attributions }, form: { cible: 'finir-1', erreurs: { fin: 'Une attribution ne peut qu’être raccourcie' }, valeurs: { fin: '2100-01-01' } } });
			expect(erreur).toMatch(/id="nouvelle-fin-1-erreur"[^>]*>Une attribution ne peut qu’être raccourcie/);
			expect(erreur).toContain('value="2100-01-01"');
			const succes = html({ data: { ...data, attributions: aucun }, form: { cible: 'finir-1', succes: true, message: 'Date de fin enregistrée' } });
			expect(succes).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Date de fin enregistrée</);
		});

		it('a des zones d\'annonce présentes dès le chargement, dans la carte et dans le formulaire d\'attribution', () => {
			const page = html({ data: { ...data, peutAttribuer }, form: null });
			const carte = page.slice(page.indexOf('>Rôles<'));
			expect(carte.match(/role="status"/g)).toHaveLength(2);
			const formulaire = carte.slice(carte.indexOf('action="?/attribuer"'));
			expect(formulaire).toMatch(/role="status"/);
			expect(formulaire).toMatch(/role="alert"/);
			const attribue = html({ data: { ...data, peutAttribuer }, form: { cible: 'attribuer', succes: true, message: 'Rôle attribué' } });
			expect(attribue).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Rôle attribué</);
		});
	});
});

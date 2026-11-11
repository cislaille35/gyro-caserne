import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

const etat = vi.hoisted(() => ({ page: { url: new URL('http://x/agents/3') } }));
vi.mock('$app/state', () => etat);

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
const data = { aujourdhui: '2026-10-27', attributions: aucun, peutAttribuer: [], fiche, raison: null, grades: [], profils: [{ id: 1, nom: 'Agent' }], equipes: [{ id: 1, nom: 'Équipe 1' }], statuts: ['operationnel', 'suspendu', 'parti'], aptitudes: [], aptitudesDuCentre: [{ id: 1, nom: 'CA2', controlee: true, ordre: 1 }] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;
// Le bouton d'un bloc (Groupe) : titre et résumé y sont écrits.
const bloc = (page: string, titre: string) => page.match(new RegExp(`<button[^>]*aria-expanded="(true|false)"[^>]*>(?:(?!</button>)[\\s\\S])*class="titre[^"]*">${titre}<(?:(?!</button>)[\\s\\S])*</button>`))!;
const ouvert = (page: string, titre: string) => bloc(page, titre)[1] === 'true';
const BLOCS = ['Identité et contact', 'Parcours', 'Équipe et statut', 'Rôles', 'Aptitudes', 'Départ du centre'];

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
			expect(entete).toMatch(/<svg[^>]*class="insigne[^"]*"[^>]*aria-hidden="true"[\s\S]*?Caporal-chef · Équipe 1/);
			// Le visage à la couleur de l'équipe, sans bandeau.
			expect(entete).not.toContain('bandeau');
			expect(entete).toMatch(/background: #b3121f[^>]*>AM</);
			expect(entete).toContain('Opérationnel');
			expect(entete).toContain('Référent engins');
			expect(entete).toMatch(/<svg[\s\S]*Référent engins/);
			expect(entete).not.toContain('Référent pharmacie');
			expect(page.match(/<h1/g)).toHaveLength(1);
		});

		it('« Courriel » ouvre la messagerie de l’appareil ; pas de lien « Appeler » sans téléphone ; « Message » seulement par la messagerie', () => {
			const page = html({ data, form: null });
			expect(page).toMatch(/<a[^>]*href="mailto:alice@exemple\.fr"[^>]*>(<!--[^>]*-->|<span class="rond[\s\S]*?<\/span>)*Courriel/);
			expect(page).not.toContain('tel:');
			expect(page).not.toContain('Appeler');
			expect(page).not.toContain('/echanges/messages/a/');
		});

		it('« Message » ouvre la conversation dans l’appli', () => {
			const page = html({ data: { ...data, ecrire: true }, form: null });
			expect(page).toMatch(/<a[^>]*href="\/echanges\/messages\/a\/3"[^>]*>(<!--[^>]*-->|<span class="rond[\s\S]*?<\/span>)*Message/);
		});

		it('« Appeler » compose le numéro quand il existe', () => {
			const page = html({ data: { ...data, fiche: { ...fiche, telephone: '06 12 34 56 78' } }, form: null });
			expect(page).toMatch(/<a[^>]*href="tel:0612345678"[^>]*>(<!--[^>]*-->|<span class="rond[\s\S]*?<\/span>)*Appeler/);
		});
	});

	describe('blocs', () => {
		it('six blocs fermés, chacun avec son résumé', () => {
			const page = html({ data, form: null });
			for (const titre of BLOCS) expect(ouvert(page, titre)).toBe(false);
			expect(bloc(page, 'Identité et contact')[0]).toContain('alice@exemple.fr');
			expect(bloc(page, 'Parcours')[0]).toContain('Aucun grade');
			expect(bloc(page, 'Équipe et statut')[0]).toContain('Aucune équipe · Opérationnel');
			expect(bloc(page, 'Rôles')[0]).toContain('Aucun rôle en cours');
			expect(bloc(page, 'Aptitudes')[0]).toContain('Aucune aptitude');
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

	describe('effacer ses données', () => {
		const parti = { ...data, fiche: { ...fiche, statut: 'parti', partiLe: '2026-10-01', effaceLe: null }, effacementPrevu: '2027-10-01' };
		const depart = (page: string) => page.slice(page.indexOf('>Départ du centre<'));

		it('dit la date de départ et celle de l’effacement automatique', () => {
			expect(bloc(html({ data: parti, form: null }), 'Départ du centre')[0]).toContain('Parti le 01/10/2026');
			expect(depart(html({ data: parti, form: null }))).toContain('Ses données seront effacées le 01/10/2027.');
		});

		it('sous « Plus », fermé : ce qui sera perdu, « Je confirme », puis le bouton grave', () => {
			const page = depart(html({ data: parti, form: null }));
			const plus = page.slice(page.indexOf('<details class="plus"'));
			expect(plus).toMatch(/^<details class="plus">\s*<summary[^>]*>Plus<\/summary>/);
			expect(plus).toMatch(/id="effacement-avertissement"[^>]*>[\s\S]*Ancien agent/);
			expect(plus).toMatch(/name="confirmation"\s+value="oui"/);
			expect(plus).toMatch(/class="grave[^"]*"[^>]*>(<!--[^>]*-->)*Effacer ses données/);
			expect(page).toContain('action="?/effacer"');
		});

		it('sans confirmation : le bloc et « Plus » s’ouvrent, l’erreur est reliée à la case', () => {
			const page = html({ data: parti, form: { erreurs: { effacement: 'Cochez « Je confirme » pour effacer ses données.' } } });
			expect(ouvert(page, 'Départ du centre')).toBe(true);
			expect(depart(page)).toMatch(/<details class="plus" open/);
			expect(page).toMatch(/aria-describedby="effacement-avertissement effacement-erreur"/);
		});

		it('un refus du socle ouvre aussi le bloc et « Plus »', () => {
			const page = html({ data: parti, form: { message: 'Vous ne pouvez pas effacer vos propres données', bloc: 'effacement' } });
			expect(ouvert(page, 'Départ du centre')).toBe(true);
			expect(depart(page)).toMatch(/<details class="plus" open/);
		});

		it('pas proposé à un agent présent ; parti sans date connue, pas de date d’effacement', () => {
			expect(html({ data, form: null })).not.toContain('Effacer ses données');
			const sansDate = html({ data: { ...parti, fiche: { ...parti.fiche, partiLe: null }, effacementPrevu: null }, form: null });
			expect(sansDate).toContain('Effacer ses données');
			expect(sansDate).not.toContain('seront effacées le');
		});

		it('effacé : la raison partout, ni formulaire ni courriel', () => {
			const raison = 'Données effacées le 12/11/2026. Cette fiche ne se modifie plus.';
			const page = html({ data: { ...parti, fiche: { ...parti.fiche, prenom: 'Ancien', nom: 'agent', email: 'efface-3@efface.invalid', effaceLe: '2026-11-12' }, effacementPrevu: null, raison }, form: null });
			expect(page).toContain('Ancien agent');
			expect(page).toContain(raison);
			expect(page).not.toContain('<form');
			expect(page).not.toContain('mailto:');
			expect(page).not.toContain('efface-3@efface.invalid');
		});
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
			enCours: [ligne(1, 'Référent engins', true), ligne(2, 'Chef de garde', false, { type: 'equipe', id: 1, nom: 'Équipe 1' })],
			aVenir: [ligne(3, 'Référent pharmacie', true)],
			passees: [ligne(4, 'Membre de comité', false, { type: 'comite', id: 2, nom: 'Amicale' })]
		};
		const peutAttribuer = [
			{ responsabiliteId: 5, nom: 'Référent engins', portee: 'centre', perimetres: [{ type: 'centre', id: null, nom: 'Centre' }] },
			{ responsabiliteId: 6, nom: 'Chef de garde', portee: 'equipe', perimetres: [{ type: 'equipe', id: 1, nom: 'Équipe 1' }] }
		];

		it('affiche les trois listes, la passée repliée, et « Terminer » seulement si permis', () => {
			const page = html({ data: { ...data, attributions, peutAttribuer: [] }, form: null });
			for (const titre of ['En cours', 'À venir', 'Passées']) expect(page).toContain(titre);
			expect(page).toContain('Référent engins');
			expect(page).toContain('Chef de garde — Équipe 1');
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

describe('la liste garde sa recherche et son filtre après un enregistrement', () => {
	it('chaque formulaire envoie vers une adresse qui les porte, sans le nom d’une action précédente', () => {
		Object.assign(etat.page, { url: new URL('http://x/agents/3?/fiche&texte=al&filtre=a-completer') });
		try {
			const peutAttribuer = [{ responsabiliteId: 9, nom: 'Référent engins', perimetres: [{ type: 'centre', id: null, nom: null }] }];
			const page = html({ data: { ...data, peutAttribuer }, form: null });
			const actions = [...page.matchAll(/action="([^"]*)"/g)].map((m) => m[1]);
			expect(actions.length).toBeGreaterThanOrEqual(5);
			for (const action of actions) expect(action).toMatch(/^\?\/(fiche|equipe|statut|attribuer|terminer|finir|aptitude|oterAptitude)&amp;texte=al&amp;filtre=a-completer$/);
		} finally {
			Object.assign(etat.page, { url: new URL('http://x/agents/3') });
		}
	});
});

describe('page fiche agent : aptitudes', () => {
	it('liste les aptitudes, dit en texte celle qui ne vaut pas aujourd’hui, et propose d’en ajouter', () => {
		const aptitudes = [
			{ aptitudeId: 1, nom: 'CA2', controlee: true, obtenueLe: '2020-01-01', expireLe: null, valide: true },
			{ aptitudeId: 4, nom: 'COD1', controlee: true, obtenueLe: '2020-01-01', expireLe: '2026-01-01', valide: false }
		];
		const page = html({ data: { ...data, aptitudes }, form: null });
		expect(bloc(page, 'Aptitudes')[0]).toContain('CA2, COD1 (expirée)');
		expect(page).toContain('Pas valable aujourd’hui');
		expect(page).toContain('expire le 01/01/2026');
		expect(page).toContain('Enregistrer l’aptitude');
	});
});

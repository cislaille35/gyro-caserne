import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const droit = (d: string, verrouille = false) => ({ droit: d, verrouille });
const role = (champs: Record<string, unknown> = {}) => ({
	id: 3,
	nom: 'Référent engins',
	nature: 'mission',
	portee: 'centre',
	attributeur: { type: 'chef_centre' },
	droits: [droit('TRAITER_ANOMALIE'), droit('GERER_FICHES'), droit('GERER_STOCK')],
	systeme: null,
	archiveeLe: null,
	modele: 'referent_materiel',
	icone: null,
	titulaires: 2,
	protegee: false,
	...champs
});
const base = {
	role: role(),
	modele: { id: 'referent_materiel', nom: 'Référent matériel', droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'] },
	comitesChoix: [{ id: 1, nom: 'Comité du centre' }],
	raison: null,
	peutPouvoir: false,
	droitsMetier: ['VOIR_PLANNING', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK'],
	droitsPouvoir: ['GERER_ACCES', 'ATTRIBUER_RESPONSABILITE', 'GERER_LISTES', 'GERER_COMITES']
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data: { ...base, ...data }, form } }).body;

describe('page d’un rôle', () => {
	it('en-tête : nom, portée, qui attribue, modèle et « Personnalisé »', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Référent engins<\/h1>/);
		expect(page).toContain('Tout le centre · nommé par le chef de centre');
		expect(page).toContain('Modèle : Référent matériel');
		expect(page).toMatch(/>(<!---->)?Personnalisé/);
		expect(html({ role: role({ droits: [droit('TRAITER_ANOMALIE'), droit('GERER_FICHES')] }) })).not.toContain('Personnalisé');
	});

	it('un groupe par domaine, résumé au niveau, sélecteur en boutons radio', () => {
		const page = html({});
		for (const nom of ['Planning et gardes', 'Engins et anomalies', 'Stock et pharmacie', 'Réservations', 'Messagerie', 'Administration de l’appli']) expect(page).toContain(`>${nom}<`);
		expect(page).not.toContain('Salons');
		expect(page).toMatch(/<input type="radio" name="niveau-engins" value="1" checked/);
		expect(page.match(/name="niveau-planning"/g)).toHaveLength(3);
		expect(page).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/enregistrer"/);
	});

	it('« Revenir au modèle » sur le seul domaine qui diffère, « Tout revenir » dans la barre', () => {
		const page = html({});
		expect(page.match(/Revenir au modèle/g)).toHaveLength(1);
		expect(page).toMatch(/<button[^>]*form="revenir"[^>]*name="domaine"[^>]*value="stock"[^>]*>↺ Revenir au modèle \(Rien de plus\)/);
		expect(page).toMatch(/<button[^>]*form="revenir"[^>]*value="tout"[^>]*>↺ Tout revenir/);
		expect(page).toMatch(/<form id="revenir" method="POST" action="\?\/revenir">/);
		expect(page).toMatch(/<button[^>]*type="submit"[^>]*>(<!---->)?Enregistrer/);
	});

	it('sans modèle : ni « Revenir au modèle » ni « Tout revenir »', () => {
		const page = html({ modele: null, role: role({ modele: null }) });
		expect(page).not.toContain('Revenir au modèle');
		expect(page).not.toContain('Tout revenir');
	});

	it('« Sur mesure » quand les droits ne tombent sur aucun niveau', () => {
		const page = html({ role: role({ droits: [droit('GERER_PLANNING')] }) });
		expect(page).toMatch(/<input type="radio" name="niveau-planning" value="sur_mesure" checked/);
		expect(page).toMatch(/Planning et gardes<\/span>[\s\S]{0,40}<span class="resume[^"]*">Sur mesure</);
	});

	it('cases d’administration grisées pour qui ne gère pas le pouvoir, avec la raison', () => {
		const page = html({ role: role({ droits: [droit('GERER_LISTES')] }) });
		expect(page).toMatch(/<input type="checkbox" name="admin" value="GERER_LISTES" checked[^>]*disabled/);
		expect(page).toContain('Seuls le chef de centre, son adjoint et le super administrateur');
		expect(page).not.toContain('name="administration"');
		const chef = html({ peutPouvoir: true });
		expect(chef).toContain('<input type="hidden" name="administration" value="oui"');
		expect(chef).not.toMatch(/name="admin"[^>]*disabled/);
	});

	describe('droits réservés à un rôle du centre', () => {
		const PHRASE = 'Réservé à un rôle du centre';
		const RESERVES = ['GERER_ACCES', 'GERER_COMITES', 'GERER_LISTES'];
		const grisee = (page: string, nom: string, droit: string) => new RegExp(`<input type="checkbox" name="${nom}" value="${droit}"[^>]*disabled`).test(page);
		const cochee = (page: string, nom: string, droit: string) => new RegExp(`<input type="checkbox" name="${nom}" value="${droit}"[^>]*checked`).test(page);

		it.each(['equipe', 'comite'])('portée « %s » : les trois cases grisées, pas « Nommer », avec la phrase, dans les deux formulaires', (portee) => {
			const page = html({ peutPouvoir: true, role: role({ portee, titulaires: 0 }) });
			for (const nom of ['admin', 'droits']) {
				for (const droit of RESERVES) expect(grisee(page, nom, droit)).toBe(true);
				expect(grisee(page, nom, 'ATTRIBUER_RESPONSABILITE')).toBe(false);
			}
			expect(page.match(new RegExp(PHRASE, 'g'))).toHaveLength(2);
			expect(page).toMatch(/<p id="admin-centre"[^>]*>Réservé à un rôle du centre/);
			expect(page).toMatch(/<p id="detail-centre"[^>]*>Réservé à un rôle du centre/);
			// La phrase est reliée à chaque case qu'elle concerne, et à elles seules.
			for (const d of RESERVES) {
				expect(page).toMatch(new RegExp(`name="admin" value="${d}"[^>]*aria-describedby="admin-centre"`));
				expect(page).toMatch(new RegExp(`name="droits" value="${d}"[^>]*aria-describedby="detail-centre"`));
			}
			expect(page).not.toMatch(/value="ATTRIBUER_RESPONSABILITE"[^>]*aria-describedby/);
		});

		it('portée « centre » : rien de grisé, pas de phrase', () => {
			const page = html({ peutPouvoir: true });
			for (const nom of ['admin', 'droits']) for (const droit of RESERVES) expect(grisee(page, nom, droit)).toBe(false);
			expect(page).not.toContain(PHRASE);
		});

		it('sans le pouvoir, sur une équipe : les deux raisons sont dites et reliées', () => {
			const page = html({ role: role({ portee: 'equipe', titulaires: 0 }) });
			expect(page).toContain('Seuls le chef de centre, son adjoint et le super administrateur');
			expect(page).toContain(PHRASE);
			expect(page).toMatch(/<fieldset class="admin[^"]*" aria-describedby="admin-aide"/);
			expect(page).toMatch(/name="admin" value="GERER_ACCES"[^>]*aria-describedby="admin-centre"/);
		});

		it('un rôle d’équipe tenu : portée fixe, sans liste, cases grisées quand même', () => {
			const page = html({ peutPouvoir: true, role: role({ portee: 'equipe', titulaires: 2 }) });
			expect(page).not.toContain('id="role-portee"');
			expect(page).toContain('Elle ne change pas tant que le rôle est tenu.');
			expect(grisee(page, 'admin', 'GERER_ACCES')).toBe(true);
			expect(page).toContain(PHRASE);
		});

		it('un rôle ancien d’équipe qui porte ces droits : cases décochées, ce que l’envoi retirera, et le compte le dit', () => {
			const page = html({ peutPouvoir: true, role: role({ portee: 'equipe', titulaires: 0, droits: [droit('GERER_ACCES'), droit('ATTRIBUER_RESPONSABILITE')] }), modele: null });
			for (const nom of ['admin', 'droits']) {
				expect(cochee(page, nom, 'GERER_ACCES')).toBe(false);
				expect(cochee(page, nom, 'ATTRIBUER_RESPONSABILITE')).toBe(true);
			}
			expect(page).toContain('1 domaine modifié, pas encore enregistré');
			expect(page).not.toMatch(/class="resume[^"]*">[^<]*Gérer les accès/);
		});

		it('après un refus du serveur sans JavaScript : la portée envoyée grise les cases du formulaire, le détail suit la portée enregistrée', () => {
			const page = html({ peutPouvoir: true, role: role({ titulaires: 0 }) }, { cible: 'role', message: 'Refusé', valeurs: { nom: 'X', portee: 'equipe', admin: ['GERER_ACCES', 'ATTRIBUER_RESPONSABILITE'] } });
			expect(page).toMatch(/<option value="equipe" selected/);
			expect(grisee(page, 'admin', 'GERER_ACCES')).toBe(true);
			expect(cochee(page, 'admin', 'GERER_ACCES')).toBe(false);
			expect(cochee(page, 'admin', 'ATTRIBUER_RESPONSABILITE')).toBe(true);
			expect(grisee(page, 'droits', 'GERER_ACCES')).toBe(false);
		});
	});

	it('rôle système : tout en lecture seule, sans formulaire ni « Revenir au modèle »', () => {
		const page = html({ peutPouvoir: true, modele: null, raison: 'Ce rôle fait partie du système : ses droits sont fixés, il ne se modifie pas.', role: role({ systeme: 'chef_equipe', modele: null, droits: [droit('VALIDER_REMPLACEMENT', true), droit('VOIR_MOTIFS_ABSENCE', true)] }) });
		expect(page).toContain('fait partie du système');
		expect(page).not.toMatch(/<form/);
		expect(page).not.toContain('Revenir au modèle');
		expect(page).not.toContain('Enregistrer');
		expect(page.match(/<fieldset class="selecteur[^"]*" disabled/g)).toHaveLength(6);
		expect(page).toMatch(/name="admin"[^>]*disabled/);
		expect(page).toContain('Valider un remplacement');
		// Les droits sans effet ne s'affichent pas, même tenus par le rôle.
		expect(page).not.toContain('Voir les motifs d’absence');
	});

	it('les droits sans effet (motifs d’absence, annuaire) ne s’affichent nulle part sur la page', () => {
		const droits = [droit('GERER_STOCK'), droit('VOIR_MOTIFS_ABSENCE'), droit('VOIR_ANNUAIRE')];
		for (const page of [html({ role: role({ droits }) }), html({ raison: 'Ce rôle est archivé : il ne se modifie plus.', role: role({ droits, archiveeLe: '2026-01-01' }) })]) {
			expect(page).not.toMatch(/motifs d’absence|annuaire|VOIR_MOTIFS_ABSENCE|VOIR_ANNUAIRE/);
		}
	});

	it('rôle système vu par le chef ou l’adjoint : les cases grisées disent pourquoi, sans parler de leurs droits', () => {
		const raison = 'Ce rôle fait partie du système : ses droits sont fixés, il ne se modifie pas.';
		const page = html({ peutPouvoir: true, modele: null, raison, role: role({ systeme: 'chef_equipe', modele: null }) });
		expect(page).not.toContain('Seuls le chef de centre, son adjoint et le super administrateur');
		expect(page).toMatch(/<p id="admin-aide" class="aide[^"]*">Ces cases ne se modifient pas sur ce rôle\./);
		expect(page).toMatch(/<fieldset class="admin[^"]*" aria-describedby="admin-aide"/);
	});

	it('message d’erreur à côté du bon formulaire, saisie réaffichée', () => {
		const page = html({}, { cible: 'role', erreurs: { nom: 'Ce nom est déjà utilisé.' }, valeurs: { nom: 'Doublon' } });
		expect(page).toContain('Ce nom est déjà utilisé.');
		expect(page).toMatch(/id="role-nom"[^>]*value="Doublon"/);
		expect(page.match(/Le formulaire contient des erreurs\./g)).toHaveLength(1);
		expect(html({}, { cible: 'role', succes: 'Le rôle « X » est enregistré.' })).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le rôle « X » est enregistré\./);
	});

	it('après un refus, réaffiche les niveaux, les cases d’administration et l’icône choisis', () => {
		const page = html({ peutPouvoir: true }, { cible: 'role', erreurs: { nom: 'Ce nom est déjà utilisé.' }, valeurs: { nom: 'Doublon', niveaux: { stock: '0', reservations: '2' }, admin: ['GERER_COMITES'], icone: 'ballon' } });
		expect(page).toMatch(/<input type="radio" name="niveau-stock" value="0" checked/);
		expect(page).toMatch(/<input type="radio" name="niveau-reservations" value="2" checked/);
		expect(page).toMatch(/<input type="checkbox" name="admin" value="GERER_COMITES" checked/);
		expect(page).toMatch(/name="icone" value="ballon" checked/);
		expect(page).toContain('3 domaines modifiés, pas encore enregistrés');
	});

	it('archiver demande « Je confirme »', () => {
		const page = html({});
		expect(page).toContain('Les 2 personnes qui tiennent ce rôle le perdent aujourd’hui, avec ses droits.');
		expect(page).toMatch(/action="\?\/archiver"[\s\S]*name="confirmation" value="oui"/);
	});

	it('choix de l’icône dans la liste fixe, celle du modèle par défaut', () => {
		const page = html({});
		expect(page.match(/name="icone"/g)).toHaveLength(14);
		expect(page).toMatch(/<input type="radio" name="icone" value="camion" checked/);
		expect(page).toContain('Camion');
	});
});

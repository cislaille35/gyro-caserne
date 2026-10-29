import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
const { default: Page } = await import('./+page.svelte');

const personne = (id: number, prenom: string, nom: string, sous: string) => ({ id, prenom, nom, surnom: null, couleur: '#1565c0', sous });
const personnes = [personne(2, 'Antoine', 'Adjoint', 'Adjoint'), personne(4, 'Élodie', 'Chef-Équipe', 'Équipe 1'), personne(6, 'Manon', 'Membre', 'Équipe 1')];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: object = {}, form: object | null = null) => render(Page as any, { props: { data: { etape: 'membres', personnes, coches: [], nom: '', icone: 'groupe', erreur: null, ...data }, form } }).body;
const texte = (page: string) => page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const coches = (page: string) => [...page.matchAll(/<input[^>]*name="membres"[^>]*>/g)].filter((m) => /\bchecked\b/.test(m[0])).map((m) => /value="(\d+)"/.exec(m[0])![1]);

describe('nouveau groupe : les membres', () => {
	it('« Annuler » vers « Nouveau message », le titre et l’étape', () => {
		const page = html();
		expect(page).toMatch(/<a[^>]*href="\/echanges\/messages\/nouveau"[^>]*>Annuler<\/a>/);
		expect(page).toMatch(/<h1[^>]*>Nouveau groupe<\/h1>/);
		expect(texte(page)).toContain('Étape 1 sur 2 : les membres');
	});

	it('une case par agent, avec son nom et son rôle ou son équipe ; les membres préremplis sont cochés', () => {
		const page = html({ coches: [4, 6] });
		expect([...page.matchAll(/<input[^>]*type="checkbox"[^>]*name="membres"/g)]).toHaveLength(3);
		expect(coches(page)).toEqual(['4', '6']);
		expect(texte(page)).toContain('Élodie Chef-Équipe Équipe 1');
		expect(texte(page)).toContain('2 personnes choisies');
	});

	it('« Suivant » mène à l’étape du nom en gardant le nom et l’icône proposés', () => {
		const page = html({ nom: 'Équipe 1', icone: 'coeur' });
		const form = page.match(/<form[^>]*method="get"[\s\S]*?<\/form>/)![0];
		expect(form).toMatch(/<input[^>]*type="hidden"[^>]*name="etape"[^>]*value="nom"/);
		expect(form).toMatch(/<input[^>]*type="hidden"[^>]*name="nom"[^>]*value="Équipe 1"/);
		expect(form).toMatch(/<input[^>]*type="hidden"[^>]*name="icone"[^>]*value="coeur"/);
		expect(form).toMatch(/<button[^>]*type="submit"[^>]*>(?:<!---->)*Suivant/);
	});

	it('l’erreur est reliée à la liste des membres', () => {
		const page = html({ erreur: 'Choisissez au moins une personne.' });
		const id = /<fieldset[^>]*aria-describedby="([^"]+)"/.exec(page)![1];
		expect(page).toMatch(new RegExp(`<p[^>]*id="${id}"[^>]*>Choisissez au moins une personne\\.</p>`));
	});

	it('une recherche par nom au-dessus de la liste, masquée sans JavaScript (elle ne filtre qu’avec lui)', () => {
		const page = html();
		expect(page).toMatch(/<input[^>]*type="search"[^>]*placeholder="Nom, prénom ou surnom"/);
		expect(page).toMatch(/<div class="recherche[^"]*"[^>]*role="search"[^>]*hidden/);
	});

	it('personne de coché : « Aucune personne choisie »', () => {
		expect(texte(html())).toContain('Aucune personne choisie');
	});
});

describe('nouveau groupe : le nom et l’icône', () => {
	const etapeNom = { etape: 'nom', coches: [4, 6], nom: 'Équipe 1', icone: 'coeur' };

	it('l’étape 2 : le nom prérempli, l’icône choisie, les membres envoyés avec « Créer »', () => {
		const page = html(etapeNom);
		expect(texte(page)).toContain('Étape 2 sur 2 : nom et icône');
		const form = page.match(/<form[^>]*method="POST"[\s\S]*?<\/form>/)![0];
		expect(form).toMatch(/action="\?\/creer"/);
		expect(form).toMatch(/<input[^>]*name="nom"[^>]*value="Équipe 1"/);
		expect(form).toMatch(/maxlength="60"/);
		expect(form).toMatch(/<input[^>]*type="radio"[^>]*name="icone"[^>]*value="coeur"[^>]*checked/);
		expect([...form.matchAll(/<input[^>]*type="hidden"[^>]*name="membres"[^>]*value="(\d+)"/g)].map((m) => m[1])).toEqual(['4', '6']);
		expect(form).toMatch(/<button[^>]*type="submit"[^>]*>(?:<!---->)*Créer/);
		// Dans la même barre collante qu'à l'étape 1.
		expect(form).toMatch(/<div class="barre[^"]*">[\s\S]*Créer/);
	});

	it('les membres choisis sont rappelés, avec un lien pour les modifier qui garde tout', () => {
		const page = html(etapeNom);
		expect(texte(page)).toContain('3 membres, vous compris');
		expect(texte(page)).toContain('Élodie Chef-Équipe');
		expect(page).not.toMatch(/<a[^>]*class="modifier[^"]*"[^>]*aria-describedby/);
		expect(page).toContain(`href="/echanges/messages/nouveau/groupe?membres=4&amp;membres=6&amp;nom=%C3%89quipe+1&amp;icone=coeur"`);
	});

	it('après un refus : les valeurs saisies, chaque erreur reliée à son champ', () => {
		const page = html(etapeNom, {
			valeurs: { nom: '', icone: 'livre', membres: [6] },
			erreurs: { nom: 'Donnez un nom au groupe.', icone: 'Choisissez une icône de la liste.', membres: '60 membres au plus, vous compris.' }
		});
		expect(page).toMatch(/<input[^>]*name="nom"[^>]*aria-invalid="true"[^>]*aria-describedby="[^"]*\bgroupe-nom-erreur\b/);
		expect(page).toMatch(/id="groupe-nom-erreur"[^>]*>Donnez un nom au groupe\./);
		expect(page).toMatch(/<input[^>]*type="radio"[^>]*value="livre"[^>]*checked/);
		expect(texte(page)).toContain('Choisissez une icône de la liste.');
		expect(page).toMatch(/id="rappel-erreur"[^>]*>60 membres au plus, vous compris\./);
		// Le lien qui permet de corriger porte l'erreur, et c'est lui qui prend le focus.
		expect(page).toMatch(/<a[^>]*class="modifier[^"]*"[^>]*aria-describedby="rappel-erreur"|<a[^>]*aria-describedby="rappel-erreur"[^>]*class="modifier[^"]*"/);
		expect([...page.matchAll(/<input[^>]*type="hidden"[^>]*name="membres"[^>]*value="(\d+)"/g)].map((m) => m[1])).toEqual(['6']);
		expect(page).toMatch(/role="alert"[^>]*>Le groupe n’a pas été créé : corrigez les erreurs\./);
	});
});

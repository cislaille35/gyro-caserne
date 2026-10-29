import { readFileSync } from 'node:fs';
import { createRawSnippet, type Component } from 'svelte';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import BarreActions from './BarreActions.svelte';
import Bouton from './Bouton.svelte';
import Carte from './Carte.svelte';
import Champ from './Champ.svelte';
import Choix from './Choix.svelte';
import Groupe from './Groupe.svelte';
import IconeRole from './IconeRole.svelte';
import Initiales from './Initiales.svelte';
import Pastille from './Pastille.svelte';
import PastilleEquipe from './PastilleEquipe.svelte';
import PastilleMur from './PastilleMur.svelte';
import Statut from './Statut.svelte';
import Tableau from './Tableau.svelte';
import Sondage from './Sondage.svelte';
import TuileDate from './TuileDate.svelte';
import Visage from './Visage.svelte';
import { ICONE_MAISON, ICONES_ROLES } from './icones-roles.ts';

const contenu = createRawSnippet(() => ({ render: () => '<span>Contenu</span>' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: Component<any>, props: Record<string, unknown>) => render(composant, { props }).body;

describe('Champ', () => {
	const base = { id: 'email', libelle: 'Adresse e-mail', name: 'email' };

	it("relie le libellé à l'input", () => {
		const page = html(Champ, base);
		expect(page).toContain('<label for="email"');
		expect(page).toMatch(/<input[^>]*id="email"/);
		expect(page).toMatch(/<input[^>]*name="email"/);
		expect(page).not.toContain('aria-invalid');
	});

	it('marque le champ obligatoire seulement si demandé', () => {
		expect(html(Champ, { ...base, requis: true })).toMatch(/<input[^>]*required/);
		expect(html(Champ, base)).not.toMatch(/<input[^>]*required/);
	});

	it("signale l'erreur et la relie à l'input", () => {
		const page = html(Champ, { ...base, erreur: 'Adresse invalide' });
		expect(page).toContain('aria-invalid="true"');
		const ref = page.match(/aria-describedby="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`id="${ref}"[^>]*>[^<]*Adresse invalide`));
	});

	it("relie l'aide à l'input", () => {
		const page = html(Champ, { ...base, aide: 'Celle de la caserne' });
		const ref = page.match(/aria-describedby="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`id="${ref}"[^>]*>[^<]*Celle de la caserne`));
	});

	it("relie l'aide et l'erreur ensemble", () => {
		const page = html(Champ, { ...base, aide: 'Aide', erreur: 'Erreur' });
		const refs = page.match(/aria-describedby="([^"]+)"/)![1].split(' ');
		expect(refs).toHaveLength(2);
	});
});

describe('PastilleMur', () => {
	const vide = { icone: null, couleur: null, numero: null };
	it('un comité : son icône sur sa teinte, décorative', () => {
		const page = html(PastilleMur, { ...vide, icone: 'coeur' });
		expect(page).toContain('aria-hidden="true"');
		expect(page).toContain('var(--icone-coeur-fond)');
		expect(page).toContain('var(--icone-coeur-texte)');
		expect(page).toContain(`d="${ICONES_ROLES.coeur}"`);
		expect(page).toContain('width: 48px');
	});
	it('Le centre : la maison sur le rouge', () => {
		const page = html(PastilleMur, { ...vide, icone: 'maison' });
		expect(page).toContain(`d="${ICONE_MAISON}"`);
		expect(page).toContain('var(--rouge)');
	});
	it('une équipe : son numéro sur sa couleur, en 28 px', () => {
		const page = html(PastilleMur, { icone: null, couleur: '#d4a017', numero: 3, taille: 28 });
		expect(page).toMatch(/>3<\/span>/);
		expect(page).toContain('#d4a017');
		expect(page).toContain('width: 28px');
		expect(page).not.toContain('<svg');
	});
});

describe('PastilleEquipe', () => {
	it('écrit le nom et cache la pastille de couleur', () => {
		const page = html(PastilleEquipe, { nom: 'Équipe A', couleur: '#2e7a1f' });
		expect(page).toContain('Équipe A');
		expect(page).toMatch(/<span[^>]*aria-hidden="true"/);
	});
});

describe('Statut', () => {
	it.each([
		['operationnel', 'Opérationnel'],
		['stagiaire', 'Stagiaire'],
		['inapte_temporaire', 'Inapte temporaire'],
		['suspendu', 'Suspendu'],
		['parti', 'Parti']
	])('%s s’écrit « %s »', (statut, texte) => {
		expect(html(Statut, { statut })).toContain(texte);
	});
});

describe('Tableau', () => {
	it('met la légende dans <caption>', () => {
		const page = html(Tableau, { legende: 'Liste des agents', children: contenu });
		expect(page).toMatch(/<caption[^>]*>\s*Liste des agents\s*<\/caption>/);
		expect(page).toContain('Contenu');
	});
});

describe('Carte', () => {
	it('rend son titre atteignable par programme quand une ancre est donnée', () => {
		expect(html(Carte, { titre: 'Bilan', ancre: 'bilan', children: contenu })).toMatch(/<h2[^>]*id="bilan"[^>]*tabindex="-1"/);
		expect(html(Carte, { titre: 'Bilan', children: contenu })).not.toContain('tabindex');
	});
	it('relie le titre h2 à la section', () => {
		const page = html(Carte, { titre: 'Prochaine garde', children: contenu });
		const ref = page.match(/<section[^>]*aria-labelledby="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`<h2[^>]*id="${ref}"[^>]*>Prochaine garde</h2>`));
	});
});

describe('Bouton', () => {
	it('se désactive à la demande (envoi en cours)', () => {
		expect(html(Bouton, { desactive: true, children: contenu })).toMatch(/<button[^>]*disabled/);
		expect(html(Bouton, { children: contenu })).not.toContain('disabled');
	});
	it('est de type button par défaut', () => {
		expect(html(Bouton, { children: contenu })).toContain('type="button"');
	});
	it('accepte le type submit', () => {
		expect(html(Bouton, { type: 'submit', children: contenu })).toContain('type="submit"');
	});
});

describe('Choix', () => {
	const base = { id: 'equipe', libelle: 'Équipe', name: 'equipe', options: [{ valeur: '', libelle: 'Toutes' }, { valeur: '1', libelle: 'Rouge' }] };

	it('relie le libellé au select et liste les options', () => {
		const page = html(Choix, base);
		expect(page).toContain('<label for="equipe"');
		expect(page).toMatch(/<select[^>]*id="equipe"/);
		expect(page).toMatch(/<select[^>]*name="equipe"/);
		expect(page).toMatch(/<option[^>]*value="1"[^>]*>Rouge</);
	});

	it('sélectionne la valeur donnée', () => {
		expect(html(Choix, { ...base, valeur: '1' })).toMatch(/<option[^>]*value="1"[^>]*selected/);
		expect(html(Choix, { ...base, valeur: '1' })).not.toMatch(/<option[^>]*value=""[^>]*selected/);
	});

	it('n’impose pas sa valeur au navigateur quand la page devient prête', () => {
		// Un choix fait avant que la page soit prête doit survivre : la liste ne remet jamais la sélection à sa valeur.
		const code = compile(readFileSync(new URL('./Choix.svelte', import.meta.url), 'utf8'), { generate: 'client' }).js.code;
		expect(code).not.toContain('bind_select_value');
		expect(code).not.toContain('select_option');
	});

	it("relie l'aide et l'erreur au select", () => {
		const page = html(Choix, { ...base, aide: 'Une aide', erreur: 'Une erreur' });
		expect(page).toContain('aria-invalid="true"');
		const refs = page.match(/aria-describedby="([^"]+)"/)![1].split(' ');
		expect(refs).toHaveLength(2);
		expect(page).toMatch(new RegExp(`id="${refs[0]}"[^>]*>[^<]*Une aide`));
		expect(page).toMatch(new RegExp(`id="${refs[1]}"[^>]*>[^<]*Une erreur`));
	});

	it('marque le champ obligatoire seulement si demandé', () => {
		expect(html(Choix, { ...base, requis: true })).toMatch(/<select[^>]*required/);
		expect(html(Choix, base)).not.toMatch(/<select[^>]*required/);
	});
});

describe('Groupe', () => {
	const base = { titre: 'Référents', resume: '4 rôles', children: contenu };

	it('fermé par défaut : bouton replié, contenu caché aux lecteurs d’écran', () => {
		const page = html(Groupe, base);
		const bouton = page.match(/<button[^>]*>/)![0];
		expect(bouton).toContain('type="button"');
		expect(bouton).toContain('aria-expanded="false"');
		const zone = bouton.match(/aria-controls="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`<div[^>]*id="${zone}"[^>]*hidden`));
		expect(page).toContain('Contenu');
	});

	it('ouvert : bouton déplié, contenu visible', () => {
		const page = html(Groupe, { ...base, ouvert: true });
		expect(page).toContain('aria-expanded="true"');
		expect(page).not.toMatch(/<div[^>]*\shidden/);
	});

	it('titre et résumé dans le bouton, au niveau de titre demandé, chevron décoratif', () => {
		expect(html(Groupe, base)).toMatch(/<h2[^>]*>\s*<button[\s\S]*Référents[\s\S]*4 rôles[\s\S]*<\/button>(\s|<!---->)*<\/h2>/);
		expect(html(Groupe, { ...base, niveauTitre: 3 })).toMatch(/<h3[^>]*>\s*<button/);
		expect(html(Groupe, base)).toMatch(/<span[^>]*aria-hidden="true"[^>]*>›<\/span>/);
	});

	it('liseré de couleur et résumé en alerte, sur demande seulement', () => {
		const page = html(Groupe, { ...base, couleur: '#b3121f', alerte: true });
		expect(page).toMatch(/<section[^>]*style="border-left: 6px solid #b3121f;?"/);
		expect(page).toMatch(/class="resume[^"]*alerte/);
		expect(html(Groupe, base)).not.toContain('border-left');
		expect(html(Groupe, base)).not.toMatch(/class="resume[^"]*alerte/);
	});

	it('action facultative à côté du titre, hors du bouton', () => {
		const action = createRawSnippet(() => ({ render: () => '<a href="/nominations">Nommer</a>' }));
		const page = html(Groupe, { ...base, action });
		expect(page).toMatch(/<\/h2>(\s|<!--[^>]*-->)*<a href="\/nominations">Nommer<\/a>/);
		expect(page.match(/<button[\s\S]*?<\/button>/)![0]).not.toContain('Nommer');
	});

	it('s’ouvre et se ferme au clic (et donc à Entrée, bouton natif)', () => {
		// Pas de DOM dans les tests : on vérifie que le code client bascule `ouvert` au clic du bouton.
		const code = compile(readFileSync(new URL('./Groupe.svelte', import.meta.url), 'utf8'), { generate: 'client' }).js.code;
		expect(code).toMatch(/'click', button, \(\) => ouvert\(!ouvert\(\)\)/);
	});
});

describe('Pastille', () => {
	it.each(['ok', 'info', 'alerte', 'danger', 'neutre'])('ton %s : écrit son texte avec les couleurs du ton', (ton) => {
		const page = html(Pastille, { ton, children: contenu });
		expect(page).toContain('Contenu');
		expect(page).toContain(`--statut-${ton}-texte`);
	});
});

describe('BarreActions', () => {
	it('annonce son message et porte les actions', () => {
		const page = html(BarreActions, { message: '2 domaines modifiés', children: contenu });
		expect(page).toMatch(/role="status"[^>]*>2 domaines modifiés</);
		expect(page).toContain('Contenu');
	});
	it('garde la zone d’annonce même sans message', () => {
		expect(html(BarreActions, { children: contenu })).toContain('role="status"');
	});
});

describe('Initiales', () => {
	it('écrit les initiales en majuscules, cachées aux lecteurs d’écran', () => {
		const page = html(Initiales, { prenom: 'émile', nom: 'Martin' });
		expect(page).toMatch(/<span[^>]*aria-hidden="true"[^>]*>ÉM<\/span>/);
	});
});

describe('IconeRole', () => {
	it.each(Object.keys(ICONES_ROLES))('%s : tuile décorative avec son tracé et sa couleur', (icone) => {
		const page = html(IconeRole, { icone });
		expect(page).toMatch(/<span[^>]*aria-hidden="true"/);
		expect(page).toContain(`d="${ICONES_ROLES[icone as keyof typeof ICONES_ROLES]}"`);
		expect(page).toContain(`--icone-${icone}-fond`);
	});
	it('a les dix icônes des rôles', () => {
		expect(Object.keys(ICONES_ROLES).sort()).toEqual(['ballon', 'camion', 'casque', 'cle', 'coeur', 'croix', 'etoile', 'groupe', 'livre', 'outil']);
	});
});

describe('Visage', () => {
	it('les initiales, décoratives : le nom est écrit à côté', () => {
		const page = html(Visage, { prenom: 'Claire', nom: 'Chef', couleur: null });
		expect(page).toContain('aria-hidden="true"');
		expect(page).toContain('>CC<');
		expect(page).toContain('var(--statut-neutre-fond)');
	});
	it('sur la couleur de l’équipe : texte foncé sur une couleur claire, blanc sur une couleur sombre', () => {
		expect(html(Visage, { prenom: 'Tom', nom: 'Agent', couleur: '#d4a017' })).toMatch(/background: #d4a017;[^"]*color: #1d2733/);
		expect(html(Visage, { prenom: 'Tom', nom: 'Agent', couleur: '#0f4c8a' })).toMatch(/background: #0f4c8a;[^"]*color: #ffffff/);
	});
	it('super administrateur ou personne inconnue : gris, sans planter', () => {
		expect(html(Visage, { prenom: 'Super', nom: 'administrateur', couleur: null })).toContain('>SA<');
		expect(html(Visage, { prenom: '', nom: 'Personne inconnue', couleur: null })).toContain('>P<');
		expect(html(Visage, { prenom: 'A', nom: 'B', couleur: 'rouge' })).toContain('var(--statut-neutre-fond)');
	});
	it('les tailles de « Nouveau message » : 48 et 44', () => {
		expect(html(Visage, { prenom: 'A', nom: 'B', couleur: null, taille: 48 })).toMatch(/class="visage[^"]*\bt48\b/);
		expect(html(Visage, { prenom: 'A', nom: 'B', couleur: null, taille: 44 })).toMatch(/class="visage[^"]*\bt44\b/);
	});
});

describe('TuileDate', () => {
	it('jour, date et mois dessinés ; la date lue en entier', () => {
		const page = html(TuileDate, { iso: '2026-11-05T19:00' });
		expect(page).toMatch(/role="img"[^>]*aria-label="jeudi 5 novembre"/);
		expect(page).toContain('>JEU.<');
		expect(page).toContain('>5<');
		expect(page).toContain('>nov.<');
	});
});

describe('Sondage', () => {
	const base = { question: 'Petit déjeuner ?', reponses: ['Oui', 'Non'], ouverture: '2026-10-29T08:00', cloture: '2026-11-02T20:00', etat: 'ouvert', resultats: null, vote: null };
	const sondage = (s: Record<string, unknown> = {}, agir = true) => html(Sondage, { id: 4, sondage: { ...base, ...s }, agir });
	it('ouvert : son état, ses dates et les choix', () => {
		const page = sondage();
		expect(page).toContain('Ouvert');
		expect(page).toContain('Du 29 oct. au lundi 2 nov., 20 h');
		expect(page).toMatch(/<button[^>]*name="reponse" value="0"[^>]*>Oui</);
		expect(page).toContain('Résultats visibles après votre vote.');
	});
	it('à venir : « Ouvre le … », sans bouton de vote', () => {
		const page = sondage({ ouverture: '2026-11-01T08:00', etat: 'avenir' });
		expect(page).toContain('Ouvre le dimanche 1 nov., 8 h');
		expect(page).not.toContain('?/voter');
	});
	it('fermé : les résultats pour tous, aucun bouton de vote', () => {
		const page = sondage({ etat: 'ferme', resultats: [3, 1] });
		expect(page).toContain('Fermé');
		expect(page).toContain('Du 29 oct. au lundi 2 nov., 20 h');
		expect(page).toContain('Oui : 3 voix, 75 %');
		expect(page).toContain('4 réponses');
		expect(page).not.toContain('?/voter');
		expect(page).not.toContain('Changer mon vote');
	});
	it('sans dates (publié avant les dates) : ouvert, sans ligne de dates', () => {
		const page = sondage({ ouverture: null, cloture: null });
		expect(page).toContain('Ouvert');
		expect(page).not.toContain('Du ');
	});
});


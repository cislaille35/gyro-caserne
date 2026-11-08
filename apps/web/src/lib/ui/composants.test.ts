import { readdirSync, readFileSync } from 'node:fs';
import { createRawSnippet, type Component } from 'svelte';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import BarreActions from './BarreActions.svelte';
import Bouton from './Bouton.svelte';
import Carte from './Carte.svelte';
import Champ from './Champ.svelte';
import ChampPhoto from './ChampPhoto.svelte';
import Choix from './Choix.svelte';
import ChoixRadio from './ChoixRadio.svelte';
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
import EnTetePage from './EnTetePage.svelte';
import ListeRangees from './ListeRangees.svelte';
import Rangee from './Rangee.svelte';
import CarteDemande from '../remplacements/CarteDemande.svelte';
import Vide from './Vide.svelte';
import Recherche from './Recherche.svelte';
import { ICONE_MAISON, ICONES_ROLES } from './icones-roles.ts';

const contenu = createRawSnippet(() => ({ render: () => '<span>Contenu</span>' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: Component<any>, props: Record<string, unknown>) => render(composant, { props }).body;

describe('ChoixRadio', () => {
	const options = [{ valeur: 'a', libelle: 'VTU' }, { valeur: 'b', libelle: 'FPT', sous: 'Fourgon' }];
	const page = (props: Record<string, unknown> = {}) => render(ChoixRadio, { props: { id: 'engin', legende: 'Engin', name: 'engin', options, ...props } }).body;

	it('des radios natifs groupés sous une légende, le choix coché, chaque ligne cliquable', () => {
		const html = page({ valeur: 'b', requis: true });
		expect(html).toMatch(/<fieldset[\s\S]*<legend[^>]*>Engin<\/legend>/);
		expect(html.match(/<input[^>]*type="radio"[^>]*name="engin"[^>]*required/g)).toHaveLength(2);
		expect(html).toMatch(/value="b"[^>]*checked/);
		expect(html).not.toMatch(/value="a"[^>]*checked/);
		expect(html).toMatch(/<label class="option[^"]*"[^>]*><input[\s\S]*?VTU[\s\S]*?<\/label>/);
		expect(html).toContain('Fourgon');
	});

	it('l’erreur est reliée au groupe, et le groupe la montre', () => {
		const html = page({ erreur: 'Choisissez un engin.' });
		expect(html).toMatch(/<fieldset[^>]*aria-describedby="engin-erreur"/);
		expect(html).toMatch(/id="engin-erreur"[^>]*>Choisissez un engin\.</);
		expect(html).toMatch(/class="options[^"]*en-erreur/);
		expect(page()).not.toContain('aria-describedby');
	});
});

describe('ChampPhoto', () => {
	const page = (props: Record<string, unknown> = {}) => render(ChampPhoto, { props: { id: 'photo', name: 'photo', libelle: 'Photo', ...props } }).body;

	it('le champ natif, nommé par un seul libellé ; le bouton écrit attend le JavaScript', () => {
		const html = page({ precision: '(facultative)', capture: 'environment' });
		expect(html).toMatch(/<label class="titre[^"]*" for="photo">Photo/);
		expect(html).toContain('(facultative)');
		expect(html).toMatch(/<input[^>]*id="photo"[^>]*name="photo"[^>]*type="file"[^>]*accept="image\/\*"[^>]*capture="environment"/);
		expect(html.match(/<label/g)).toHaveLength(1);
		expect(html).not.toContain('Ajouter une photo');
		expect(html).not.toContain('Retirer');
	});

	it('plusieurs photos, aide et erreur reliées au champ', () => {
		const html = page({ multiple: true, appel: 'Ajouter des photos', aide: '4 au plus.', erreur: 'Photo illisible.' });
		expect(html).toMatch(/<input[^>]*multiple/);
		expect(html).toMatch(/<input[^>]*aria-invalid="true"[^>]*aria-describedby="photo-aide photo-erreur"/);
		expect(html).toMatch(/id="photo-erreur"[^>]*>Photo illisible\.</);
	});
});

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

	it('sur plusieurs lignes : une zone de texte, mêmes liens (libellé, aide, obligatoire, longueur)', () => {
		const page = html(Champ, { ...base, lignes: 4, aide: 'Quelle pièce ?', requis: true, maxlength: 500 });
		expect(page).not.toContain('<input');
		expect(page).toMatch(/<textarea[^>]*id="email"[^>]*name="email"[^>]*required[^>]*maxlength="500"[^>]*rows="4"/);
		const ref = page.match(/aria-describedby="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`id="${ref}"[^>]*>[^<]*Quelle pièce \\?`));
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
		expect(html(Groupe, base)).toMatch(/<svg class="chevron[^"]*"[^>]*aria-hidden="true"/);
	});

	it('une icône en tête, sur demande seulement', () => {
		expect(html(Groupe, { ...base, icone: 'etoile' })).toMatch(/<button[^>]*>(\s|<!--[^>]*-->)*<span class="tuile[^"]*" aria-hidden="true"/);
		expect(html(Groupe, base)).not.toContain('class="tuile');
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
	it('a les onze icônes des rôles', () => {
		expect(Object.keys(ICONES_ROLES).sort()).toEqual(['ballon', 'camion', 'casque', 'cle', 'coeur', 'croix', 'etoile', 'groupe', 'livre', 'outil', 'veste']);
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
		// Les infos d'une conversation à deux.
		expect(html(Visage, { prenom: 'A', nom: 'B', couleur: null, taille: 88 })).toMatch(/class="visage[^"]*\bt88\b/);
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
		expect(page).toContain('Du 29 oct. au lundi 2 nov., 20 h');
		expect(page).toMatch(/<button[^>]*name="reponse" value="0"[^>]*>Oui</);
		expect(page).toContain('Résultats visibles après votre vote.');
	});
	it('à venir : « Ouvre le … », sans bouton de vote', () => {
		const page = sondage({ ouverture: '2026-11-01T08:00', etat: 'avenir' });
		expect(page).toContain('Ouvre le dimanche 1 nov., 8 h');
		expect(page).not.toContain('?/voter');
	});
	it('fermé : les résultats pour tous, aucun bouton de vote', () => {
		const page = sondage({ etat: 'ferme', resultats: [3, 1] });
		expect(page).toContain('Fermé');
		expect(page).toContain('Du 29 oct. au lundi 2 nov., 20 h');
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

// Sans les repères d'hydratation de Svelte.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const net = (composant: Component<any>, props: Record<string, unknown>) => html(composant, props).replace(/<!--[\s\S]*?-->/g, '');

describe('EnTetePage', () => {
	it('le titre en h1, atteignable par programme, et la phrase', () => {
		const page = net(EnTetePage, { titre: 'Caserne', phrase: 'Tout le centre en un coup d’œil.' });
		expect(page).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Caserne<\/h1>/);
		expect(page).toContain('Tout le centre en un coup d’œil.');
		expect(page).not.toContain('<svg');
	});
	it('action principale : un lien rond rouge, son libellé toujours lu', () => {
		const page = net(EnTetePage, { titre: 'Agents', action: { href: '/agents/nouveau', libelle: 'Ajouter' } });
		expect(page).toMatch(/<a[^>]*class="action[^"]*"[^>]*href="\/agents\/nouveau"[^>]*>[\s\S]*?<svg[^>]*aria-hidden="true"[\s\S]*?Ajouter<\/span>/);
	});
	it('action principale : le libellé se voit à toutes les tailles, jamais masqué', () => {
		const css = readFileSync(new URL('./EnTetePage.svelte', import.meta.url), 'utf8').match(/<style>([\s\S]*)<\/style>/)?.[1] ?? '';
		expect(css).not.toMatch(/clip-path|clip:|width:\s*1px|display:\s*none/);
		expect(css).not.toContain('@media');
	});
	it('retour au-dessus du titre, nommé', () => {
		const page = net(EnTetePage, { titre: 'Mon profil', retour: { href: '/moi', libelle: 'Moi' } });
		expect(page).toMatch(/<a[^>]*href="\/moi"[^>]*>[\s\S]*?Retour : <\/span>Moi<\/a>/);
		expect(page.indexOf('href="/moi"')).toBeLessThan(page.indexOf('<h1'));
	});
	it('la tête (Gyro de l’Accueil) se pose à droite du titre', () => {
		const page = net(EnTetePage, { titre: 'Bonjour', tete: contenu });
		expect(page.indexOf('<h1')).toBeLessThan(page.indexOf('<span>Contenu</span>'));
		expect(page).not.toContain('mascotte');
	});
	it('pas de Gyro dans les titres ordinaires : il reste à l’Accueil, dans les écrans vides et les réussites', () => {
		const source = readFileSync(new URL('./EnTetePage.svelte', import.meta.url), 'utf8');
		expect(source).not.toMatch(/GyroDuMoment|gyro\?:/);
		const racine = new URL('../../routes/', import.meta.url);
		const pages = (readdirSync(racine, { recursive: true }) as string[]).filter((p) => p.endsWith('.svelte'));
		for (const p of pages) {
			for (const m of readFileSync(new URL(p, racine), 'utf8').matchAll(/<EnTetePage\b[^>]*?\/?>/g)) expect(m[0], p).not.toMatch(/\sgyro\b/);
		}
	});
	it('une action secondaire à côté', () => {
		expect(net(EnTetePage, { titre: 'Agents', secondaire: contenu })).toContain('<span>Contenu</span>');
	});
	it('pas de phrase qui répète le titre ou l’évidence sous les en-têtes (audit C8) : seulement une info, un nombre, une date, un état', () => {
		const racine = new URL('../../routes/', import.meta.url);
		const enTetes = (p: string) => [...readFileSync(new URL(p, racine), 'utf8').matchAll(/<EnTetePage\b[\s\S]*?\/?>/g)].map((m) => m[0]);
		for (const p of ['agents/+layout.svelte', 'caserne/+page.svelte', 'moi/+page.svelte', 'moi/agenda/+page.svelte', 'reservations/miennes/+page.svelte', 'reservations/materiel/+page.svelte', 'engins/+page.svelte', 'engins/anomalies/+page.svelte', 'remplacements/+page.svelte', 'reglages/+page.svelte'])
			for (const t of enTetes(p)) expect(t, p).not.toMatch(/\sphrase[=\s>]/);
		const sources = ['affichage/+page.svelte', 'reservations/a-valider/+page.svelte', 'engins/fiches/+page.svelte', 'engins/fiches/[id]/+page.svelte', 'nominations/+page.svelte', 'planning/+page.svelte', 'moi/vacances/+page.svelte', 'engins/prise/+page.svelte'].map((p) => readFileSync(new URL(p, racine), 'utf8')).join('\n');
		for (const t of ['Le thème et la présence de Gyro', 'Les demandes de réservation des ressources que vous gérez', 'ce que l’équipe vérifie, zone par zone', 'Ce que l’équipe vérifie à la prise de garde', 'Qui tient quel rôle', 'Les astreintes et les manœuvres de l’année', 'Vos vacances d’été, pour le planning', 'Choisissez un engin'])
			expect(sources).not.toContain(t);
	});
});

describe('Rangee', () => {
	it('un lien : toute la ligne, titre, sous-ligne, valeur et chevron décoratif', () => {
		const page = net(Rangee, { href: '/agents', titre: 'Agents', sous: 'L’effectif du centre', valeur: '14 agents' });
		expect(page).toMatch(/^<a[^>]*class="rangee[^"]*"[^>]*href="\/agents"/);
		expect(page).toContain('Agents');
		expect(page).toContain('L’effectif du centre');
		expect(page).toContain('14 agents');
		expect(page).toMatch(/class="chevron[^"]*"[^>]*aria-hidden="true"/);
	});
	it('une sous-ligne par info quand il y en a trop pour une ligne', () => {
		const page = net(Rangee, { titre: 'VSAV 1', sous: ['VSAV · AB-123-CD', 'Prise à faire · 1 anomalie ouverte'] });
		expect(page).toMatch(/<span class="sous[^"]*">VSAV · AB-123-CD<\/span><span class="sous[^"]*">Prise à faire · 1 anomalie ouverte<\/span>/);
	});
	it('une tuile seulement sur demande : elle porte un sens (type, rôle)', () => {
		expect(net(Rangee, { href: '/reglages/roles/3', titre: 'Référent', icone: 'casque' })).toContain('var(--icone-casque-fond)');
		expect(net(Rangee, { href: '/agents', titre: 'Agents' })).not.toContain('tuile');
	});
	it('sans lien : ni chevron ni lien', () => {
		const page = net(Rangee, { titre: 'Engins', sous: 'Bientôt' });
		expect(page).toMatch(/^<div[^>]*class="rangee/);
		expect(page).not.toContain('<a');
		expect(page).not.toContain('chevron');
	});
	it('avec des gestes dessous : le titre est le lien, étendu à toute la ligne ; les gestes passent par-dessus', () => {
		const page = net(Rangee, { href: '/echanges/centre/2', titre: 'Manœuvre', children: contenu });
		expect(page).toMatch(/^<div[^>]*class="rangee[^"]*\bgestes\b/);
		expect(page).toMatch(/<a class="titre etire[^"]*"[^>]*href="\/echanges\/centre\/2"[^>]*>Manœuvre<\/a>/);
		expect(page).toMatch(/<div class="inclus[^"]*"><span>Contenu<\/span><\/div>/);
		expect(page).not.toContain('chevron');
	});
	it('alerte : le signe d’alerte en tête, jamais la couleur seule', () => {
		const page = net(Rangee, { href: '/nominations', titre: 'Équipe 2 sans chef de garde', alerte: true });
		expect(page).toMatch(/class="rangee[^"]*\balerte\b/);
		expect(page).toMatch(/class="signe[^"]*"[^>]*aria-hidden="true"[\s\S]*?<svg/);
	});
	it('alerte avec une tuile : le signe d’alerte reste, à droite', () => {
		const page = net(Rangee, { href: '/reglages', titre: 'Photos', icone: 'camion', alerte: true });
		expect(page).toContain('var(--icone-camion-fond)');
		expect(page).toMatch(/class="signe[^"]*\ba-droite\b[^"]*"[^>]*aria-hidden="true"/);
	});
	it('alerte avec une tête : le signe d’alerte passe à droite', () => {
		const page = net(Rangee, { href: '/remplacements/2', titre: 'Remplacement', alerte: true, tete: contenu });
		expect(page).toMatch(/class="signe[^"]*\ba-droite\b[^"]*"[^>]*aria-hidden="true"/);
		expect(net(Rangee, { titre: 'Photos', tete: contenu })).not.toContain('class="signe');
	});
	it('courant : la page affichée, dite par aria-current', () => {
		expect(net(Rangee, { href: '/reglages/roles/3', titre: 'Référent', courant: true })).toMatch(/^<a[^>]*aria-current="page"/);
		expect(net(Rangee, { href: '/reglages/roles/3', titre: 'Référent' })).not.toContain('aria-current');
	});
	it('discret : ce qui n’existe pas encore, sans lien', () => {
		const page = net(Rangee, { titre: 'Engins', sous: 'Bientôt', discret: true });
		expect(page).toMatch(/^<div[^>]*class="rangee[^"]*\bdiscret\b/);
		expect(page).not.toContain('<a');
	});
	it('une tête et une droite sur mesure', () => {
		const page = net(Rangee, { titre: 'Claire', tete: contenu, droite: contenu });
		expect(page.match(/<span>Contenu<\/span>/g)).toHaveLength(2);
	});
});

describe('CarteDemande', () => {
	const v = {
		id: 7,
		genre: 'remplacement',
		etat: 'attente',
		moi: 'remplacant',
		demandeur: { prenom: 'David', nom: 'Leroy' },
		texte: 'nuit du 18 nov.',
		remplacant: null,
		cible: null,
		manque: [],
		manquePourMoi: [],
		gestes: { accepter: true }
	};
	it('le titre mène à la demande, étendu à toute la demande ; plus de lien « Détails »', () => {
		const page = net(CarteDemande, { v, niveau: 2 });
		expect(page).toMatch(/<h2[^>]*><a class="etire[^"]*" href="\/remplacements\/7">Je remplace David Leroy<span class="masque">[^<]*nuit du 18 nov\.<\/span><\/a><\/h2>/);
		expect(page).not.toContain('Détails');
		expect(page).toMatch(/<button type="submit"[^>]*>Accepter/);
	});
	it('sur sa page : le titre seul, sans lien', () => {
		const page = net(CarteDemande, { v, detail: false });
		expect(page).not.toContain('href="/remplacements/7"');
	});
	it('dans une liste : une ligne de la carte, pas une carte', () => {
		expect(net(CarteDemande, { v, ligne: true })).toMatch(/<article class="carte[^"]*\bligne\b/);
		expect(net(CarteDemande, { v })).not.toMatch(/<article class="carte[^"]*\bligne\b/);
	});
});

describe('ListeRangees', () => {
	it('une seule carte pour le groupe : une liste explicite, sans rubrique', () => {
		const page = net(ListeRangees, { children: contenu });
		expect(page).toMatch(/^<ul role="list" class="lignes[^"]*">/);
		expect(page).not.toContain('<h2');
	});
	it('le titre du groupe au-dessus de la carte, relié à sa section, avec son compteur', () => {
		const page = net(ListeRangees, { titre: 'À décider', compte: 5, children: contenu });
		const ref = page.match(/<section[^>]*aria-labelledby="([^"]+)"/)![1];
		expect(page).toMatch(new RegExp(`<h2[^>]*id="${ref}"[^>]*class="titre-groupe[^"]*"[^>]*>À décider <span class="compte[^"]*">5</span></h2>\\s*<ul role="list" class="lignes`));
	});
	it('ancre : le titre reçoit cet id et peut prendre le focus', () => {
		expect(net(ListeRangees, { titre: 'À ne pas manquer', ancre: 'a-ne-pas-manquer', children: contenu })).toMatch(/<h2[^>]*id="a-ne-pas-manquer"[^>]*tabindex="-1"/);
	});
});

describe('Vide', () => {
	it('titre, explication et action', () => {
		const page = net(Vide, { titre: 'Tout est à jour', texte: 'Rien ne vous attend.', action: { href: '/echanges', libelle: 'Aller aux échanges' } });
		expect(page).toContain('Tout est à jour');
		expect(page).toContain('Rien ne vous attend.');
		expect(page).toMatch(/<a[^>]*href="\/echanges"[^>]*>Aller aux échanges<\/a>/);
	});
	it('la phrase seule reste possible', () => {
		const page = net(Vide, { texte: 'Le planning arrive bientôt.' });
		expect(page).toContain('Le planning arrive bientôt.');
		expect(page).not.toContain('<a');
	});
});

describe('Recherche', () => {
	it('libellé lu, aide reliée au champ, loupe qui envoie le formulaire', () => {
		const page = net(Recherche, { id: 'q', name: 'q', valeur: 'mar', libelle: 'Rechercher un agent', aide: 'Nom ou e-mail', bouton: { name: 'filtre', value: 'partis' } });
		expect(page).toMatch(/<label for="q"[^>]*>Rechercher un agent<\/label>/);
		expect(page).toMatch(/<input id="q" type="search" name="q" value="mar"[^>]*aria-describedby="q-aide"/);
		expect(page).toMatch(/<p id="q-aide"[^>]*>Nom ou e-mail<\/p>/);
		expect(page).toMatch(/<button type="submit"[^>]*name="filtre" value="partis"[\s\S]*?<svg[^>]*aria-hidden="true"[\s\S]*?>Rechercher</);
	});
});

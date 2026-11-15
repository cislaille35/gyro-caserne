import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Le journal du Worker est gardé par Cloudflare (décision 0036) : une erreur n'y part que résumée par resumeErreur,
// qui retire adresses, liens, jetons et valeurs de la base. Ce test n'accepte, dans un appel à la console, que des arguments
// connus pour ne rien porter de personnel.
const appli = fileURLToPath(new URL('..', import.meta.url));
const racines = ['src', '../../packages/socle/src'].map((r) => join(appli, r));

// Arguments sûrs : un texte fixe, un résumé, un nom d'erreur, un statut ou une longueur.
const SURS = [/^'[^'$]*'$/, /^(resumeErreur|sansDonnees)\(.*\)$/s, /^[\w.]+\.(name|status|length)$/, /^(\w+) instanceof Error \? \1\.name : typeof \1$/];
// Exceptions relues une à une.
const EXCEPTIONS: Record<string, string> = {
	"event.route.id ?? 'page inconnue'": 'le modèle de la page (/agents/[id]), sans identifiant',
	'lignePage(event, deBetterAuth)': 'le modèle de la page, la méthode et l’action, sans valeur de la requête (page-au-journal.test.ts)',
	"url.split('?')[0]": "l'adresse de l'API météo, sans ses paramètres",
	niveau: 'le niveau du message de Better Auth',
	'...details.map((d) => (d instanceof Error ? resumeErreur(d) : typeof d))': 'les détails de Better Auth, résumés',
	// Écrit seulement quand l'appli tourne en local (courriel.ts, testé) : jamais en ligne.
	'`Courriel pour ${m.a} : ${m.sujet}\\n${m.texte}`': 'le courriel, en local seulement'
};

// Les arguments de chaque appel à la console (console.x(…) ou console[…](…)), même sur plusieurs lignes.
function appels(source: string): string[][] {
	const resultat: string[][] = [];
	for (const debut of source.matchAll(/console(\.\w+|\[[^\]]*\])\s*\(/g)) {
		const args: string[] = [];
		let profondeur = 0;
		let courant = '';
		let guillemet = '';
		for (let i = debut.index + debut[0].length; i < source.length; i++) {
			const c = source[i]!;
			if (guillemet) {
				courant += c;
				if (c === '\\') courant += source[++i] ?? '';
				else if (c === guillemet) guillemet = '';
				continue;
			}
			if (c === "'" || c === '"' || c === '`') guillemet = c;
			if ('([{'.includes(c)) profondeur++;
			if (')]}'.includes(c)) {
				if (profondeur === 0) break;
				profondeur--;
			}
			if (c === ',' && profondeur === 0) {
				args.push(courant.trim());
				courant = '';
			} else courant += c;
		}
		if (courant.trim()) args.push(courant.trim());
		resultat.push(args);
	}
	return resultat;
}

function fautes(source: string): string[] {
	return appels(source)
		.flat()
		.filter((arg) => !SURS.some((sur) => sur.test(arg)) && !(arg in EXCEPTIONS));
}

function fichiers(dossier: string): string[] {
	return readdirSync(dossier, { withFileTypes: true }).flatMap((f) => {
		const chemin = join(dossier, f.name);
		if (f.isDirectory()) return fichiers(chemin);
		return /\.(ts|svelte)$/.test(f.name) && !/\.test\.ts$/.test(f.name) ? [chemin] : [];
	});
}

describe('journal du Worker', () => {
	it('ne reçoit que des arguments sûrs', () => {
		const trouvees = racines.flatMap(fichiers).flatMap((fichier) => fautes(readFileSync(fichier, 'utf8')).map((arg) => `${relative(appli, fichier)} : ${arg}`));
		expect(trouvees).toEqual([]);
	});

	it('refuse une erreur brute, son message, un texte composé, un objet ou un appel sur plusieurs lignes qui en porte', () => {
		expect(fautes("console.error('Échec', e);")).toEqual(['e']);
		expect(fautes("console.warn('x', erreur.message)")).toEqual(['erreur.message']);
		expect(fautes('console.log(`Échec : ${erreur}`)')).toEqual(['`Échec : ${erreur}`']);
		expect(fautes("console.error('x', { erreur })")).toEqual(['{ erreur }']);
		expect(fautes("console.error(\n\t'x',\n\tString(cause)\n)")).toEqual(['String(cause)']);
		expect(fautes("console[niveau]('x', reponse)")).toEqual(['reponse']);
		expect(fautes("console.trace('x', ex)")).toEqual(['ex']);
	});

	it('accepte un texte fixe, un résumé, un nom d’erreur ou un statut', () => {
		expect(fautes("console.error('Échec', resumeErreur(e), r.status, ids.length, e instanceof Error ? e.name : typeof e)")).toEqual([]);
	});
});

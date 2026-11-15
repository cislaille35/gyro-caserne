import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Le journal du Worker est gardé par Cloudflare (décision 0036) : une erreur n'y part que résumée par resumeErreur,
// qui retire adresses, liens, jetons et valeurs de la base. Ce test refuse une erreur passée brute à la console.
const racines = ['.', '../../../packages/socle/src'].map((r) => fileURLToPath(new URL(r, import.meta.url)));

function fichiers(dossier: string): string[] {
	return readdirSync(dossier, { withFileTypes: true }).flatMap((f) => {
		const chemin = join(dossier, f.name);
		if (f.isDirectory()) return fichiers(chemin);
		return /\.(ts|svelte)$/.test(f.name) && !/\.test\.ts$/.test(f.name) ? [chemin] : [];
	});
}

const ERREUR_BRUTE = /console\.(log|info|warn|error|debug)\((.*)\)/;

describe('journal du Worker', () => {
	it('ne reçoit aucune erreur brute', () => {
		const fautifs: string[] = [];
		for (const fichier of racines.flatMap(fichiers)) {
			readFileSync(fichier, 'utf8')
				.split('\n')
				.forEach((ligne, i) => {
					const appel = ligne.match(ERREUR_BRUTE)?.[2];
					if (appel && /(^|,\s*)(e|err|erreur|error)\s*(,|\)|$)/.test(appel)) fautifs.push(`${fichier}:${i + 1}`);
				});
		}
		expect(fautifs).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// La copie hebdomadaire de la base part chiffrée par e-mail (décision 0029). Le dépôt est public :
// ces règles gardent qu'aucune donnée ne reste sur GitHub et que les secrets restent à leur étape.
const chemin = fileURLToPath(new URL('../../../.github/workflows/copie-hebdomadaire.yml', import.meta.url));
const texte = existsSync(chemin) ? readFileSync(chemin, 'utf8') : '';

// Les blocs `run: |` du fichier, avec leur contenu
function blocsRun(source: string): string[] {
	const lignes = source.split('\n');
	const blocs: string[] = [];
	lignes.forEach((ligne, i) => {
		const debut = ligne.match(/^(\s*)(- )?run: \|\s*$/);
		if (!debut) return;
		const retrait = debut[1].length + (debut[2] ? 2 : 0);
		const contenu: string[] = [];
		for (const suite of lignes.slice(i + 1)) {
			if (suite.trim() !== '' && suite.search(/\S/) <= retrait) break;
			contenu.push(suite.trim());
		}
		blocs.push(contenu.filter(Boolean).join('\n'));
	});
	return blocs;
}

describe('copie hebdomadaire', () => {
	it('le workflow existe', () => {
		expect(texte).not.toBe('');
	});

	it('n’a aucun droit sur le dépôt', () => {
		expect(texte).toMatch(/^permissions: \{\}$/m);
	});

	it('ne laisse rien sur GitHub : ni artefact, ni cache', () => {
		expect(texte).not.toMatch(/upload-artifact|actions\/cache|cache:/);
	});

	it('vise la production le dimanche, et à la main la production ou la préprod', () => {
		expect(texte).toMatch(/cron: '\d+ \d+ \* \* 0'/);
		expect(texte).toMatch(/options: \[production, preprod\]/);
	});

	it('télécharge age à une adresse fixe et vérifie son empreinte', () => {
		expect(texte).toContain('https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz');
		expect(texte).toContain('cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10');
		expect(texte).toMatch(/sha256sum -c/);
	});

	it('refuse une copie de plus de 4 000 000 octets', () => {
		expect(texte).toMatch(/LIMITE_OCTETS: 4000000/);
	});

	it('efface ses fichiers en fin de passage, même en cas d’échec', () => {
		expect(texte).toMatch(/- name: Ménage\n\s+if: always\(\)\n\s+run: rm -rf "\$RUNNER_TEMP\/copie"/);
	});

	it('chaque commande commence par set -euo pipefail', () => {
		const blocs = blocsRun(texte);
		expect(blocs.length).toBeGreaterThan(3);
		for (const bloc of blocs) expect(bloc.split('\n')[0]).toBe('set -euo pipefail');
	});

	it('ne donne les secrets qu’à l’étape qui s’en sert', () => {
		const [avantEtapes] = texte.split(/^\s+steps:$/m);
		expect(avantEtapes).not.toMatch(/secrets\./);
		expect(texte.match(/secrets\.CLOUDFLARE_API_TOKEN/g)).toHaveLength(1);
		// Ailleurs, seule la présence de la clé Brevo est lue (comparaison à vide)
		expect(texte.match(/secrets\.BREVO_CLE_PRODUCTION \}\}/g)).toHaveLength(1);
		expect(texte.match(/secrets\.BREVO_CLE_PREPROD \}\}/g)).toHaveLength(1);
	});

	it('n’affiche jamais la sortie de wrangler', () => {
		const exports = texte.split('\n').filter((ligne) => ligne.includes('wrangler d1 export'));
		expect(exports).toHaveLength(1);
		expect(exports[0]).toMatch(/> "\$DOSSIER\/wrangler\.log" 2>&1/);
	});
});

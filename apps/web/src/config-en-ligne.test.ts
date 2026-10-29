import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { configEnLigne } from '../scripts/config-en-ligne.ts';

const exemple = readFileSync(new URL('../../../centres/exemple/wrangler.jsonc', import.meta.url), 'utf8');

describe('configEnLigne', () => {
	it('marque les deux bases, principale et photos, « remote », sans rien changer d’autre', () => {
		const copie = configEnLigne(exemple);
		expect(copie).toContain('"binding": "BASE", "remote": true,');
		expect(copie).toContain('"binding": "PHOTOS", "remote": true,');
		expect(copie.replaceAll(' "remote": true,', '')).toBe(exemple);
	});

	it('refuse une config où il manque une des deux bases', () => {
		expect(() => configEnLigne(exemple.replace('"binding": "PHOTOS",', '"binding": "AUTRE",'))).toThrow('Base PHOTOS introuvable dans wrangler.jsonc');
		expect(() => configEnLigne(exemple.replace('"binding": "BASE",', '"binding": "AUTRE",'))).toThrow('Base BASE introuvable dans wrangler.jsonc');
	});
});

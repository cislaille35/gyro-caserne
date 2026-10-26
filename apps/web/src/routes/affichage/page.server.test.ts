import { describe, expect, it } from 'vitest';
import { actions } from './+page.server';

const OPTIONS = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true, secure: true };

function appeler(corps: string) {
	const poses: { nom: string; valeur: string; options: unknown }[] = [];
	const cookies = { set: (nom: string, valeur: string, options: unknown) => poses.push({ nom, valeur, options }) };
	const request = new Request('http://localhost/affichage', {
		method: 'POST',
		body: new URLSearchParams(corps),
		headers: { 'content-type': 'application/x-www-form-urlencoded' }
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const resultat = (actions.default as any)({ request, cookies });
	return { poses, resultat };
}

describe('action /affichage', () => {
	it('pose les deux cookies', async () => {
		const { poses, resultat } = appeler('niveau=equilibre&theme=sombre');
		await resultat;
		expect(poses).toEqual([
			{ nom: 'niveau', valeur: 'equilibre', options: expect.objectContaining({ ...OPTIONS, secure: expect.any(Boolean) }) },
			{ nom: 'theme', valeur: 'sombre', options: expect.objectContaining({ ...OPTIONS, secure: expect.any(Boolean) }) }
		]);
	});
	it('refuse une valeur inconnue sans poser de cookie', async () => {
		const { poses, resultat } = appeler('niveau=equilibre&theme=bleu');
		expect(await resultat).toMatchObject({ status: 400 });
		expect(poses).toEqual([]);
	});
});

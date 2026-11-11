import { describe, expect, it } from 'vitest';
import { ecussonDuCentre } from '@gyro-caserne/socle';
import { charger, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

const webp = (taille = 100) => {
	const o = new Uint8Array(taille);
	o.set([...'RIFF'].map((c) => c.charCodeAt(0)));
	o.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
	return new File([o], 'ecusson.webp', { type: 'image/webp' });
};
const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], 'ecusson.png', { type: 'image/png' });

// Une action appelée comme SvelteKit, avec un formulaire en plusieurs parties (fichier).
function envoyer(nom: 'deposer' | 'retirer', locals: unknown, corps: [string, string | File][]) {
	const f = new FormData();
	for (const [c, v] of corps) f.append(c, v);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (actions[nom] as any)({ locals, params: {}, url: new URL('http://x/reglages/ecusson'), request: new Request('http://x/reglages/ecusson', { method: 'POST', body: f }) });
}

describe('réglages : écusson du centre', () => {
	it('réservé à qui gère les listes du centre', async () => {
		const { base, ordinaire } = await preparer();
		await expect(charger(load, locaux(base, ordinaire))).rejects.toMatchObject({ status: 403 });
		await expect(envoyer('deposer', locaux(base, ordinaire), [['image', webp()]])).rejects.toMatchObject({ status: 403 });
	});

	it('vide, puis déposé, remplacé et retiré avec confirmation', async () => {
		const { base, referent } = await preparer();
		const l = locaux(base, referent);
		expect(await charger(load, l)).toEqual({ ecusson: null });
		expect(await envoyer('deposer', l, [['image', webp()]])).toEqual({ cible: 'ecusson', succes: 'Écusson enregistré.' });
		const premier = await ecussonDuCentre(base);
		expect(await charger(load, l)).toEqual({ ecusson: premier });
		await envoyer('deposer', l, [['image', webp(120)]]);
		expect(await ecussonDuCentre(base)).not.toBe(premier);
		expect(await envoyer('retirer', l, [])).toMatchObject({ status: 400, data: { message: 'Cochez « Je confirme » pour continuer.' } });
		expect(await ecussonDuCentre(base)).not.toBeNull();
		expect(await envoyer('retirer', l, [['confirmation', 'oui']])).toEqual({ cible: 'retirer', succes: 'Écusson retiré.' });
		expect(await ecussonDuCentre(base)).toBeNull();
	});

	it('sans image, ou une image refusée : l’erreur sous le champ', async () => {
		const { base, referent } = await preparer();
		const l = locaux(base, referent);
		expect(await envoyer('deposer', l, [])).toMatchObject({ status: 400, data: { erreurs: { image: 'Choisissez une image.' } } });
		expect(await envoyer('deposer', l, [['image', png()]])).toMatchObject({ status: 400, data: { erreurs: { image: 'Image JPEG ou WebP seulement.' } } });
		expect(await envoyer('deposer', l, [['image', webp(200 * 1024 + 1)]])).toMatchObject({ status: 400, data: { erreurs: { image: 'Image trop lourde : 200 Ko au plus.' } } });
		expect(await ecussonDuCentre(base)).toBeNull();
	});
});

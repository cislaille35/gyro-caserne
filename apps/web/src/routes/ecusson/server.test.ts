import { describe, expect, it } from 'vitest';
import { deposerEcusson } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { locaux, preparer } from '../reglages/de-test.ts';
import { GET } from './+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const demander = (locals: unknown, v: string | null) => (GET as any)({ locals, url: new URL(`http://x/ecusson${v === null ? '' : `?v=${v}`}`) });
const webp = () => {
	const o = new Uint8Array(100);
	o.set([...'RIFF'].map((c) => c.charCodeAt(0)));
	o.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
	return { type: 'image/webp', donnees: o };
};

describe('l’image de l’écusson', () => {
	it('servie à tous (page de connexion comprise), gardée un an par le navigateur pour sa version', async () => {
		const { base, referent } = await preparer();
		const v = await deposerEcusson(base, base.photos, referent, webp(), maintenantParis());
		const reponse: Response = await demander(locaux(base, null), String(v));
		expect(reponse.status).toBe(200);
		expect(reponse.headers.get('content-type')).toBe('image/webp');
		expect(reponse.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
		expect(reponse.headers.get('x-content-type-options')).toBe('nosniff');
		expect(new Uint8Array(await reponse.arrayBuffer())).toEqual(webp().donnees);
	});

	it('404 sans écusson, sans version, ou pour une autre version', async () => {
		const { base, referent } = await preparer();
		await expect(demander(locaux(base, null), '1')).rejects.toMatchObject({ status: 404 });
		const v = await deposerEcusson(base, base.photos, referent, webp(), maintenantParis());
		await expect(demander(locaux(base, null), null)).rejects.toMatchObject({ status: 404 });
		await expect(demander(locaux(base, null), 'abc')).rejects.toMatchObject({ status: 404 });
		await expect(demander(locaux(base, null), String(v + 1))).rejects.toMatchObject({ status: 404 });
	});
});

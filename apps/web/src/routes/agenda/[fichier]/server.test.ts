import { describe, expect, it } from 'vitest';
import { monLienAgenda } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { GET } from './+server';
import { preparer } from '../../planning/de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lire = (base: unknown, fichier: string) => (GET as any)({ locals: { base, acteur: null }, params: { fichier } });

describe('/agenda/<lien>.ics', () => {
	it('sert le fichier sans connexion, en text/calendar, jamais en cache public', async () => {
		const { base, alice } = await preparer();
		const lien = await monLienAgenda(base, alice, maintenantParis());
		const r: Response = await lire(base, `${lien}.ics`);
		expect(r.status).toBe(200);
		expect(r.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
		expect(r.headers.get('cache-control')).toContain('private');
		expect(await r.text()).toContain('BEGIN:VCALENDAR');
	});

	it('404 sans détail pour un lien faux ou sans .ics', async () => {
		const { base, alice } = await preparer();
		const lien = await monLienAgenda(base, alice, maintenantParis());
		for (const fichier of [`${alice.id}-${'x'.repeat(43)}.ics`, lien, 'rien.ics']) {
			const r: Response = await lire(base, fichier);
			expect(r.status).toBe(404);
			expect(await r.text()).toBe('Introuvable');
		}
	});
});

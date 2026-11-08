import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import { load } from './+page.server';
import { load as nominations } from '../nominations/+page.server';
import { preparer } from '../echanges/de-test.ts';
import { preparer as preparerEngins } from '../engins/de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data } }).body;
const lien = (href: string, libelle: string) => new RegExp(`<a[^>]*href="${href}"[^>]*>[\\s\\S]*?${libelle}[\\s\\S]*?</a>`);

describe('/caserne', () => {
	it('demande la connexion', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((load as any)({ locals: { acteur: null } })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('l’effectif pour tous ; ce qui est à pourvoir pour qui peut nommer, le même compte que la page Nominations', async () => {
		const { base, chef, alice } = await preparer();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const charger = (acteur: unknown) => (load as any)({ locals: { base, acteur } });
		expect(await charger(alice)).toEqual({ agents: 3, aPourvoir: null, engins: 0, anomalies: 0 });
		const pourLeChef = await charger(chef);
		expect(pourLeChef.agents).toBe(3);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { roles } = await (nominations as any)({ locals: { base, acteur: chef }, url: new URL('http://x/nominations') });
		const vides = roles.filter((r: { titulaires: unknown[] }) => r.titulaires.length === 0).length;
		expect(vides).toBeGreaterThan(0);
		expect(pourLeChef.aPourvoir).toBe(vides);
	});

	it('agent ordinaire : « Agents », sans « Nominations » ni « Réglages »', () => {
		const page = html({ peutNominations: false, peutReglages: false });
		expect(page).toMatch(lien('/agents', 'Agents'));
		expect(page).not.toContain('href="/nominations"');
		expect(page).not.toContain('href="/reglages"');
	});

	it('chef de centre : « Agents », « Nominations » et « Réglages »', () => {
		const page = html({ peutNominations: true, peutReglages: true });
		expect(page).toMatch(lien('/agents', 'Agents'));
		expect(page).toMatch(lien('/nominations', 'Nominations'));
		expect(page).toMatch(lien('/reglages', 'Réglages'));
	});

	it('des chiffres utiles : l’effectif, et ce qui est à pourvoir pour qui décide', () => {
		const page = html({ peutNominations: true, peutReglages: false, agents: 14, aPourvoir: 3 });
		expect(page).toMatch(lien('/agents', '14 agents'));
		expect(page).toMatch(lien('/nominations', '3 à pourvoir'));
		expect(html({ peutNominations: true, peutReglages: false, agents: 1, aPourvoir: 0 })).not.toMatch(/>\d+ à pourvoir</);
		expect(html({ peutNominations: false, peutReglages: false, agents: 1, aPourvoir: null })).toContain('1 agent<');
	});

	it('« Réservations » pour tous, vers la VL et le matériel', () => {
		const page = html({});
		expect(page).toMatch(/href="\/reservations"[\s\S]*?Réservations[\s\S]*?La VL et le matériel de l’amicale/);
	});

	it('« Comités et référents » pour tous ; plus de groupe « Bientôt »', () => {
		const page = html({ peutNominations: false, peutReglages: false });
		expect(page).toMatch(/href="\/comites"[\s\S]*?Comités et référents[\s\S]*?Qui fait quoi au centre/);
		expect(page).not.toContain('Bientôt');
		expect(page).not.toContain('arrivent bientôt');
	});

	it('deux groupes : l’organisation, puis le matériel', () => {
		const page = html({ peutNominations: true, peutReglages: true, engins: 3, anomalies: 1 });
		const organisation = page.indexOf('>Organisation<');
		const materiel = page.indexOf('>Matériel<');
		expect(organisation).toBeGreaterThan(-1);
		expect(materiel).toBeGreaterThan(organisation);
		for (const href of ['/agents', '/comites', '/nominations', '/reglages']) expect(page.indexOf(`href="${href}"`)).toBeLessThan(materiel);
		for (const href of ['/engins', '/engins/anomalies', '/reservations']) expect(page.indexOf(`href="${href}"`)).toBeGreaterThan(materiel);
	});

	it('« Engins » pour qui les voit, avec le nombre d’engins au centre', async () => {
		expect(html({ engins: 3 })).toMatch(lien('/engins', '3 engins'));
		expect(html({ engins: null })).not.toContain('href="/engins"');
		const { base, sans, alice } = await preparerEngins();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const charger = (acteur: unknown) => (load as any)({ locals: { base, acteur } });
		expect((await charger(alice)).engins).toBe(2);
		expect((await charger(sans)).engins).toBeNull();
		expect((await charger(sans)).anomalies).toBeNull();
	});

	it('« Anomalies » pour qui voit les engins, avec le nombre d’ouvertes', () => {
		expect(html({ engins: 3, anomalies: 2 })).toMatch(lien('/engins/anomalies', '2 ouvertes'));
		expect(html({ engins: 3, anomalies: 0 })).toMatch(lien('/engins/anomalies', 'Aucune ouverte'));
		expect(html({ engins: null, anomalies: null })).not.toContain('href="/engins/anomalies"');
	});
});

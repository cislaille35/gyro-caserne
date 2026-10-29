import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const profil = { surnom: null, telephone: null, telephoneVisible: false, contactUrgence: null, anniversaireVisible: true, cochesLecture: true };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data: { profil, messagerie: true, ...data }, form: null } }).body;

describe('page Mon profil', () => {
	it('« Montrer quand j’ai lu les messages » : cochée selon le profil, expliquée, avec son repère', () => {
		const page = html({});
		expect(page).toMatch(/<input type="checkbox" name="cochesLecture"[^>]*checked[^>]*aria-describedby="aide-coches"/);
		expect(page).toMatch(/Montrer quand j’ai lu les messages/);
		expect(page).toMatch(/id="aide-coches"[^>]*>[^<]*vous ne voyez plus non plus celles des autres/);
		expect(page).toContain('<input type="hidden" name="avecCoches" value="1"');
		expect(html({ profil: { ...profil, cochesLecture: false } })).not.toMatch(/name="cochesLecture"[^>]*checked/);
	});

	it('sans messagerie : ni case ni repère', () => {
		const page = html({ messagerie: false });
		expect(page).not.toContain('cochesLecture');
		expect(page).not.toContain('avecCoches');
	});
});

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const ete = { annee: 2027, debut: '2027-06-25', fin: '2027-09-03', dateLimite: '2027-05-15', publiee: false };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (vacances: unknown, form: unknown = null) => render(Page as any, { props: { data: { vacances }, form } }).body;

describe('Mes vacances', () => {
	it('pas encore ouvert : le dire', () => {
		expect(page({ ete: null, reponse: null, periodes: [] })).toContain('pas encore ouverte');
	});

	it('rien donné : les deux façons de répondre, dates bornées à l’été', () => {
		const html = page({ ete, reponse: null, periodes: [] });
		expect(html).toContain('Vous n’avez encore rien donné.');
		expect(html).toContain('Je suis disponible tout l’été');
		expect(html).toMatch(/<input type="date" name="debut" required="" min="2027-06-25" max="2027-09-02"/);
		expect(html).toContain('À donner avant le samedi 15 mai.');
	});

	it('des périodes : chacune se retire, avec un nom accessible ; publié, le chef est prévenu d’un changement', () => {
		const html = page({ ete: { ...ete, publiee: true }, reponse: { toutEte: false, modifieeLe: '2027-03-01T10:00' }, periodes: [{ id: 1, debut: '2027-07-10', fin: '2027-07-20' }] });
		expect(html).toContain('Vous avez donné 1 période de vacances.');
		expect(html.replace(/<!--[^>]*-->/g, "")).toMatch(/Retirer<span class="masque[^"]*"> la période 10 – 20 juil\./);
		expect(html).toContain('un changement prévient le chef');
	});
});

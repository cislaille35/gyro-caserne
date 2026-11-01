import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: unknown, form: unknown = null) => render(Page as any, { props: { data, form } }).body;
const lien = 'https://caserne.exemple.fr/agenda/3-abc.ics';
const avec = (appareil: string | null) => ({ lien, webcal: lien.replace('https://', 'webcal://'), appareil });

describe('Ajouter à mon agenda', () => {
	it('« À quoi ça sert ? » en 3 lignes, le bouton principal en webcal, « Copier le lien » à côté', () => {
		const html = page(avec(null));
		expect(html).toContain('À quoi ça sert ?');
		expect(html.match(/<ul class="sert[^"]*">([\s\S]*?)<\/ul>/)![1]!.match(/<li/g)).toHaveLength(3);
		expect(html).toMatch(/<a class="principal[^"]*" href="webcal:\/\/caserne\.exemple\.fr\/agenda\/3-abc\.ics">[\s\S]*?Ajouter à mon agenda/);
		expect(html).toContain('Copier le lien');
		expect(html).toContain(lien);
	});

	it('mode d’emploi replié par application ; celui du téléphone ouvert d’office', () => {
		const ordinateur = page(avec(null));
		for (const t of ['Google Agenda', 'iPhone', 'Outlook']) expect(ordinateur).toMatch(new RegExp(`<details[^>]*><summary[^>]*>[^<]*${t}`));
		expect(ordinateur).not.toMatch(/<details[^>]*open/);
		expect(page(avec('iphone'))).toMatch(/<details[^>]*open[^>]*><summary[^>]*>[^<]*iPhone/);
		expect(page(avec('android'))).toMatch(/<details[^>]*open[^>]*><summary[^>]*>[^<]*Google Agenda/);
		expect((page(avec('android')).match(/<details[^>]*open/g) ?? []).length).toBe(1);
	});

	it('en bas : la mise à jour de l’agenda, ne pas le partager, « Changer le lien »', () => {
		const html = page(avec(null));
		expect(html).toContain('L’agenda peut mettre quelques heures à se mettre à jour ; l’appli est toujours à jour.');
		expect(html).toContain('ne le partagez pas');
		expect(html.indexOf('Changer le lien')).toBeGreaterThan(html.indexOf('Outlook'));
	});

	it('après « Changer le lien », le dit', () => {
		expect(page(avec(null), { change: true })).toContain('Nouveau lien créé');
	});

	it('sans planning : le dit', () => {
		expect(page({ lien: null, sansPlanning: true })).toContain('Le planning est réservé aux agents du centre.');
	});

	it('le super administrateur n’a pas d’agenda', () => {
		expect(page({ lien: null })).toContain('Le super administrateur n’a pas de planning');
	});
});

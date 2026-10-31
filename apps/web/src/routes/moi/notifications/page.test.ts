import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Page from './+page.svelte';
import CeTelephone from './CeTelephone.svelte';

/* eslint-disable @typescript-eslint/no-explicit-any */
const html = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data: { clePublique: 'BPub', tout: false, coupes: [], appareils: 0, ...data }, form } }).body;
const telephone = (etat: string, appareils = 0) => render(CeTelephone as any, { props: { etat, appareils, activer: () => {}, desactiver: () => {} } }).body;

describe('page Moi → Notifications', () => {
	it('« Tout couper » : un interrupteur qui dit son état, dans un formulaire qui marche sans JavaScript', () => {
		expect(html({})).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/toutCouper"[\s\S]*?<button[^>]*role="switch"[^>]*aria-checked="false"[^>]*name="oui"[^>]*value="1"/);
		expect(html({ tout: true })).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*name="oui"[^>]*value="0"/);
		expect(html({})).toContain('La cloche de l’appli montre toujours tout.');
	});

	it('les lieux coupés, chacun avec « Réactiver » nommé ; rien de coupé : comment couper', () => {
		const page = html({ coupes: [{ lieu: 'mur:equipe:2', nom: 'Équipe 2' }, { lieu: 'conversation:5', nom: 'Pot de départ' }] });
		expect(page).toMatch(/Équipe 2[\s\S]*?<input type="hidden" name="lieu" value="mur:equipe:2"[\s\S]*?Réactiver<span class="masque[^"]*"> Équipe 2<\/span>/);
		expect(page).toContain('Pot de départ');
		expect(html({})).toContain('Rien n’est coupé.');
	});

	it('sans clés VAPID : les notifications au téléphone ne sont pas encore en place', () => {
		expect(html({ clePublique: null })).toContain('pas encore en place pour ce centre');
	});

	it('ce téléphone, selon son état', () => {
		expect(telephone('inactif')).toMatch(/<button[^>]*>(<!---->)?Activer sur ce téléphone(<!---->)?<\/button>/);
		expect(telephone('actif', 2)).toMatch(/Activées sur ce téléphone[\s\S]*Désactiver sur ce téléphone/);
		expect(telephone('actif', 2)).toContain('2 appareils');
		const iphone = telephone('ios-a-installer');
		expect(iphone).toMatch(/<ol[\s\S]*Partager[\s\S]*Sur l’écran d’accueil[\s\S]*depuis son icône[\s\S]*<\/ol>/);
		expect(telephone('refuse')).toContain('bloquées');
		expect(telephone('indisponible')).toContain('ne reçoit pas les notifications');
	});
});

describe('appli installable', () => {
	it('le manifeste : nom, ouverture en plein écran, icônes présentes', () => {
		const manifeste = JSON.parse(readFileSync(new URL('../../../../static/manifest.webmanifest', import.meta.url), 'utf8'));
		expect(manifeste).toMatchObject({ name: 'Gyro Caserne', start_url: '/', display: 'standalone', lang: 'fr' });
		for (const icone of manifeste.icons) expect(readFileSync(new URL(`../../../../static${icone.src}`, import.meta.url)).length).toBeGreaterThan(0);
		expect(manifeste.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
		const html = readFileSync(new URL('../../../app.html', import.meta.url), 'utf8');
		expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
		expect(html).toContain('<link rel="apple-touch-icon" href="/icones/apple-touch-icon.png" />');
	});
});

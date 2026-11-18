import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Page from './+page.svelte';
import CeTelephone from './CeTelephone.svelte';

/* eslint-disable @typescript-eslint/no-explicit-any */
const html = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data: { clePublique: 'BPub', tout: false, coupes: [], appareils: 0, urgences: null, courriel: null, ...data }, form } }).body;
const telephone = (etat: string, appareils = 0) => render(CeTelephone as any, { props: { etat, appareils, activer: () => {}, desactiver: () => {} } }).body;

describe('page Moi → Notifications', () => {
	it('« Tout couper » : un interrupteur qui dit son état, dans un formulaire qui marche sans JavaScript', () => {
		expect(html({})).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/toutCouper"[\s\S]*?<button[^>]*role="switch"[^>]*aria-checked="false"[^>]*name="oui"[^>]*value="1"/);
		expect(html({ tout: true })).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*name="oui"[^>]*value="0"/);
		expect(html({})).toContain('La cloche de l’appli montre toujours tout.');
	});

	it('pour le chef et l’adjoint : « Urgences du centre » en premier, expliquées, avec leur interrupteur ; pas pour un agent', () => {
		const page = html({ urgences: true });
		expect(page).toMatch(/Urgences du centre[\s\S]*Ce téléphone[\s\S]*Tout couper/);
		expect(page).toContain('engin indisponible');
		expect(page).toMatch(/<form[^>]*action="\?\/urgences"[\s\S]*?role="switch"[^>]*aria-checked="true"[^>]*name="oui"[^>]*value="0"/);
		expect(html({ urgences: false })).toMatch(/action="\?\/urgences"[\s\S]*?role="switch"[^>]*aria-checked="false"[^>]*name="oui"[^>]*value="1"/);
		expect(html({})).not.toContain('Urgences du centre');
	});

	it('« Tout couper » coupe aussi les urgences : l’écran prévient le chef', () => {
		expect(html({ urgences: true, tout: true })).toContain('Vous ne recevrez plus les urgences du centre (engin indisponible…)');
		expect(html({ urgences: true })).not.toContain('Vous ne recevrez plus les urgences');
		expect(html({ tout: true })).not.toContain('Vous ne recevrez plus les urgences');
	});

	it('« Recevoir les demandes par e-mail » pour qui tient un rôle, coché par défaut ; pas pour les autres', () => {
		expect(html({ courriel: true })).toMatch(/<form[^>]*action="\?\/courriel"[\s\S]*?role="switch"[^>]*aria-checked="true"[^>]*name="oui"[^>]*value="0"[\s\S]*?Recevoir les demandes par e-mail/);
		expect(html({ courriel: false })).toMatch(/action="\?\/courriel"[\s\S]*?aria-checked="false"[^>]*name="oui"[^>]*value="1"/);
		expect(html({})).not.toContain('Recevoir les demandes par e-mail');
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
	it('le manifeste : ce que Chrome exige pour proposer l’installation (nom, plein écran, adresse de départ, icônes 192 et 512, couleurs)', () => {
		const manifeste = JSON.parse(readFileSync(new URL('../../../../static/manifest.webmanifest', import.meta.url), 'utf8'));
		expect(manifeste).toMatchObject({ id: '/', name: 'Gyro Caserne', short_name: 'Gyro Caserne', start_url: '/', scope: '/', display: 'standalone', lang: 'fr', theme_color: expect.stringMatching(/^#/), background_color: expect.stringMatching(/^#/) });
		for (const taille of ['192x192', '512x512']) expect(manifeste.icons.some((i: { sizes: string; type: string }) => i.sizes === taille && i.type === 'image/png'), taille).toBe(true);
		for (const icone of manifeste.icons) expect(readFileSync(new URL(`../../../../static${icone.src}`, import.meta.url)).length).toBeGreaterThan(0);
		expect(manifeste.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
		const html = readFileSync(new URL('../../../app.html', import.meta.url), 'utf8');
		expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
		expect(html).toContain('<link rel="apple-touch-icon" href="/icones/apple-touch-icon.png" />');
	});
});

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { GRADES_DE_DEPART } from '@gyro-caserne/socle';
import Insigne from './Insigne.svelte';
import { cleDe, dessinDe, insigneDe, INSIGNES } from './insignes.ts';

const html = (props: Record<string, unknown>) => render(Insigne, { props: props as never }).body;

describe('insignes de grade', () => {
	it('chaque grade du jeu de départ a son insigne, sauf ceux qui n’en portent pas', () => {
		const sans = GRADES_DE_DEPART.filter(([, libelle]) => insigneDe(libelle) === null).map(([, l]) => l);
		expect(sans).toEqual(SANS_INSIGNE);
	});

	it('reconnu par son libellé, sans tenir compte des accents, des majuscules ni des traits d’union', () => {
		expect(cleDe('Caporal-Chef')).toBe('caporal chef');
		expect(insigneDe('CAPORAL CHEF')).toBe(INSIGNES['caporal chef']);
		expect(insigneDe('Sapeur de 1ère classe')).toBe(INSIGNES['sapeur 1re classe']);
		expect(insigneDe('Lieutenant-colonel')).toBe(INSIGNES['lieutenant colonel']);
	});

	it('d’après l’annexe II : galons obliques des sapeurs aux sergents, droits des adjudants et officiers ; couleurs et nombre', () => {
		const resume = (l: string) => insigneDe(l)!.map((g) => `${g.forme === 'oblique' ? '/' : '='}${g.couleur}${g.bord ? '+bord' : ''}${g.raie ? '+raie' : ''}`).join(' ');
		expect(resume('Sapeur 1re classe')).toBe('/rouge');
		expect(resume('Caporal-chef')).toBe('/rouge /rouge /rouge');
		expect(resume('Sergent')).toBe('/argent+bord');
		expect(resume('Sergent-chef')).toBe('/argent+bord /argent+bord /argent+bord');
		expect(resume('Adjudant')).toBe('=or+raie');
		expect(resume('Adjudant-chef')).toBe('=argent+raie');
		expect(resume('Commandant')).toBe('=argent =argent =argent =argent');
		expect(resume('Lieutenant-colonel')).toBe('=argent =or =argent =or =argent');
		expect(insigneDe('Sapeur 2e classe')).toBeNull();
	});

	it('un grade saisi à la main, inconnu, ou pas de grade : aucun insigne, rien d’affiché', () => {
		expect(insigneDe('Brigadier')).toBeNull();
		expect(insigneDe(null)).toBeNull();
		expect(html({ grade: 'Brigadier' })).not.toContain('<svg');
		expect(html({ grade: null })).not.toContain('<svg');
	});

	it('nommé par le grade pour les lecteurs d’écran ; caché quand le grade est écrit à côté', () => {
		expect(html({ grade: 'Sergent' })).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Sergent"/);
		expect(html({ grade: 'Sergent' })).toContain('<title>Sergent</title>');
		const deco = html({ grade: 'Sergent', decoratif: true });
		expect(deco).toMatch(/<svg[^>]*aria-hidden="true"/);
		expect(deco).not.toContain('role="img"');
		expect(deco).not.toContain('<title>');
	});

	it('des couleurs par jetons seulement, et des galons qui tiennent dans la patte', () => {
		for (const libelle of Object.keys(INSIGNES)) {
			// Tous les points dans le carré noir (de 2 à 22), avec une marge.
			const nombres = dessinDe(libelle)!.flatMap((f) => ('points' in f ? f.points.split(/[ ,]/).map(Number) : [f.x, f.y, f.x + f.l, f.y + f.h]));
			for (const n of nombres) expect(n, libelle).toBeGreaterThanOrEqual(3);
			for (const n of nombres) expect(n, libelle).toBeLessThanOrEqual(21);
			expect(html({ grade: libelle })).not.toMatch(/#[0-9a-f]{3,6}/i);
		}
	});
});

const SANS_INSIGNE: string[] = ['Jeune sapeur-pompier', 'Sapeur'];

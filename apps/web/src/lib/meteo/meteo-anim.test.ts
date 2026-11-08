import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import MeteoAnim from './MeteoAnim.svelte';

describe('ambiance de l’Accueil', () => {
	it('le soleil de jour, jamais la nuit', () => {
		expect(render(MeteoAnim, { props: { ambiance: 'clair' } }).body).toContain('soleil');
		expect(render(MeteoAnim, { props: { ambiance: 'clair', nuit: true } }).body).not.toContain('soleil');
		expect(render(MeteoAnim, { props: { ambiance: 'chaleur', nuit: false } }).body).toContain('soleil');
		expect(render(MeteoAnim, { props: { ambiance: 'chaleur', nuit: true } }).body).not.toContain('soleil');
	});

	it('la pluie reste la nuit', () => {
		expect(render(MeteoAnim, { props: { ambiance: 'pluie', nuit: true } }).body).toContain('goutte');
	});
});

describe('MeteoAnim : pas de mouvement sans fin', () => {
	it('s’arrête quand on le lui dit', () => {
		const arrete = render(MeteoAnim, { props: { ambiance: 'pluie', anime: false } }).body;
		expect(arrete).toMatch(/class="meteo m-pluie[^"]*arrete/);
		expect(render(MeteoAnim, { props: { ambiance: 'pluie' } }).body).not.toMatch(/arrete/);
	});
});

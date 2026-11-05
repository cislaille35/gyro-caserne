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

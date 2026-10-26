import { describe, expect, it } from 'vitest';
import { load } from './+layout.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appeler = (acteur: unknown) => (load as any)({ locals: { acteur, affichage: { niveau: 1, theme: 'clair' } } });

describe('load du layout', () => {
	it('distingue personne connectée, super administrateur et visiteur', () => {
		expect(appeler({ type: 'personne', id: 1 })).toMatchObject({ connecte: true, estPersonne: true });
		expect(appeler({ type: 'super', email: 'a@b.fr' })).toMatchObject({ connecte: true, estPersonne: false });
		expect(appeler(null)).toMatchObject({ connecte: false, estPersonne: false });
	});
});

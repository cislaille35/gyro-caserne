import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const mienne = { id: 1, theme: 'Sport + SAP', debut: '2026-11-15T08:30' };
const autre = { id: 2, theme: 'Incendie', debut: '2026-11-22T08:30' };
const bruno = { id: 5, prenom: 'Bruno', nom: 'Test', manoeuvres: [autre] };
const base = { miennes: [mienne, { id: 3, theme: 'Désincarcération', debut: '2026-12-06T08:30' }], collegues: [bruno], mienne, sienne: null, court: true, etape: 'sienne', message: null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: Record<string, unknown>) => render(Page as any, { props: { data: { ...base, ...data }, form: null } }).body;

describe('Échanger ma place à une manœuvre', () => {
	it('lancé depuis la manœuvre : deux étapes, la mienne rappelée, les manœuvres des collègues en choix', () => {
		const html = page({});
		expect(html).toContain('Étape 1 sur 2');
		expect(html).toContain('Votre manœuvre : <strong>« Sport + SAP », dimanche 15 novembre, 8 h 30</strong>');
		expect(html).toMatch(/name="sienne" value="5:2"/);
		expect(html).toContain('name="depuis" value="planning"');
	});

	it('vérifier : la phrase, puis Proposer l’échange en POST', () => {
		const html = page({ etape: 'verifier', sienne: { collegue: bruno, manoeuvre: autre } });
		expect(html).toContain('Étape 2 sur 2');
		expect(html).toContain('Vous proposez à Bruno Test d’aller à votre place à « Sport + SAP », dimanche 15 novembre, 8 h 30, et vous allez à « Incendie », dimanche 22 novembre, 8 h 30.');
		expect(html).toMatch(/<form method="POST"[\s\S]*name="mienne" value="1"[\s\S]*name="sienne" value="5:2"[\s\S]*Proposer l’échange/);
	});

	it('depuis Remplacements : trois étapes, on commence par choisir sa manœuvre', () => {
		const html = page({ court: false, mienne: null, etape: 'mienne' });
		expect(html).toContain('Étape 1 sur 3');
		expect(html).toMatch(/name="mienne" value="1" checked/);
	});
});

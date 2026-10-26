import { describe, expect, it } from 'vitest';
import { appliquerAffichage, lireAffichage } from '#lib/affichage.ts';

const cookies = (valeurs: Record<string, string>) => ({ get: (nom: string) => valeurs[nom] });

describe('lireAffichage', () => {
	it('prend vivant et auto sans cookie', () => {
		expect(lireAffichage(cookies({}))).toEqual({ niveau: 'vivant', theme: 'auto' });
	});
	it('reprend des valeurs connues', () => {
		expect(lireAffichage(cookies({ niveau: 'sobre', theme: 'sombre' }))).toEqual({ niveau: 'sobre', theme: 'sombre' });
	});
	it('ignore les valeurs inconnues ou vides', () => {
		expect(lireAffichage(cookies({ niveau: '<script>', theme: 'bleu' }))).toEqual({ niveau: 'vivant', theme: 'auto' });
		expect(lireAffichage(cookies({ niveau: '', theme: '' }))).toEqual({ niveau: 'vivant', theme: 'auto' });
	});
});

describe('appliquerAffichage', () => {
	it('remplace les deux repères', () => {
		const html = '<html data-theme="%gyro.theme%" data-niveau="%gyro.niveau%">';
		expect(appliquerAffichage(html, { niveau: 'sobre', theme: 'clair' })).toBe('<html data-theme="clair" data-niveau="sobre">');
	});
});

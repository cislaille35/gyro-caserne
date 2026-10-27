import type { Apercu as TypeApercu, Operation } from '@gyro-caserne/socle';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Apercu from './Apercu.svelte';
import CompteRendu from './CompteRendu.svelte';
import Page from './+page.svelte';
import { resumer } from './textes.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (composant: any, props: Record<string, unknown>) => render(composant, { props }).body;
const texte = (page: string) => page.replace(/<!--[^>]*-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const depart = (personneId: number): Operation => ({ ligne: 0, type: 'statut', personneId, statut: 'parti' });
const vide: TypeApercu = { departs: [], arrivees: [], modifications: [], erreurs: [], perimees: [], colonnesIgnorees: [], operations: [] };
const complet: TypeApercu = {
	departs: [
		{ personneId: 10, nom: 'Zoé Zorro' },
		{ personneId: 11, nom: 'Yves Yole' },
		{ personneId: 12, nom: 'Xavier Xu' }
	],
	arrivees: [{ ligne: 4, nom: 'Bob Durand' }],
	modifications: [{ ligne: 3, nom: 'Alice Martin', changements: [{ colonne: 'Grade', avant: 'Caporal', apres: 'Sergent' }, { colonne: 'Téléphone', avant: '', apres: '06 12 34 56 78' }] }],
	erreurs: [
		{ ligne: 12, colonne: 'Équipe', message: '« Equipe 5 » n’existe pas' },
		{ ligne: 0, colonne: null, message: 'Vous ne pouvez pas vous mettre au départ par le fichier' }
	],
	perimees: [
		{ ligne: 5, nom: 'Paul Petit' },
		{ ligne: 0, nom: 'Léa Absente' }
	],
	colonnesIgnorees: ['Comité : Fanfare'],
	operations: [depart(10), depart(11), depart(12)]
};

describe('page « Fichier de l\'effectif »', () => {
	it('propose le modèle, l\'export et l\'import d\'un .xlsx, avec une zone d\'avancement annoncée', () => {
		const page = html(Page, { data: { aujourdhui: '2026-10-27' } });
		expect(page).toMatch(/<h1[^>]*>Fichier de l'effectif<\/h1>/);
		expect(texte(page)).toContain('Télécharger le modèle vierge');
		expect(texte(page)).toContain("Exporter l'effectif");
		const id = page.match(/<input[^>]*type="file"[^>]*id="([^"]+)"/)?.[1] ?? page.match(/<input[^>]*id="([^"]+)"[^>]*type="file"/)?.[1];
		expect(id).toBeDefined();
		expect(page).toMatch(/<input[^>]*accept="\.xlsx/);
		expect(page).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>Importer un fichier`));
		expect(page).toContain('aria-live="polite"');
	});
});

describe('aperçu de l\'import', () => {
	it('met les départs en tête, avec leur nombre et leurs noms, puis arrivées et modifications', () => {
		const page = texte(html(Apercu, { apercu: complet }));
		expect(page).toContain('3 départs');
		expect(page.indexOf('3 départs')).toBeLessThan(page.indexOf('1 arrivée'));
		expect(page.indexOf('1 arrivée')).toBeLessThan(page.indexOf('1 modification'));
		expect(page).toContain('Zoé Zorro');
		expect(page).toContain('Ligne 4 : Bob Durand');
		expect(page).toMatch(/Grade : Caporal → (devient )?Sergent/);
		expect(page).toMatch(/Téléphone : \(vide\) → (devient )?06 12 34 56 78/);
	});

	it('accorde le nombre de départs', () => {
		expect(texte(html(Apercu, { apercu: { ...vide, departs: [{ personneId: 1, nom: 'A B' }], operations: [depart(1)] } }))).toContain('1 départ ');
		expect(texte(html(Apercu, { apercu: vide }))).toContain('Aucun départ');
	});

	it('liste les erreurs ligne par ligne, les lignes périmées et les colonnes ignorées', () => {
		const page = texte(html(Apercu, { apercu: complet }));
		expect(page).toContain('Ligne 12, Équipe : « Equipe 5 » n’existe pas');
		expect(page).toContain('Vous ne pouvez pas vous mettre au départ par le fichier');
		expect(page).toContain('Ligne 5 : Paul Petit');
		expect(page).toContain('Léa Absente');
		expect(page).toContain('Comité : Fanfare');
	});

	it('résume l\'aperçu juste avant « Valider », sans les catégories vides', () => {
		expect(resumer(complet)).toBe('3 départs, 1 arrivée, 1 modification, 2 erreurs');
		expect(resumer({ ...vide, departs: [{ personneId: 1, nom: 'A B' }], modifications: [complet.modifications[0]!, complet.modifications[0]!] })).toBe('1 départ, 2 modifications');
		const page = texte(html(Apercu, { apercu: complet }));
		expect(page).toMatch(/3 départs, 1 arrivée, 1 modification, 2 erreurs[^]*Valider/);
	});

	it('propose « Valider » seulement s\'il y a une opération, « Abandonner » toujours', () => {
		const avec = texte(html(Apercu, { apercu: complet }));
		expect(avec).toContain('Valider');
		expect(avec).toContain('Abandonner');
		const sans = texte(html(Apercu, { apercu: { ...complet, departs: [], operations: [] } }));
		expect(sans).not.toContain('Valider');
		expect(sans).toContain('Abandonner');
	});

	it('après validation, ne garde que ce qui n\'a pas été appliqué', () => {
		const page = texte(html(Apercu, { apercu: complet, apres: true }));
		expect(page).not.toContain('Zoé Zorro');
		expect(page).not.toContain('Bob Durand');
		expect(page).not.toContain('Valider');
		expect(page).toContain('Ligne 12, Équipe');
		expect(page).toContain('Paul Petit');
	});
});

describe('compte rendu', () => {
	it('donne les opérations appliquées, les erreurs avec leur message et le rappel de réexporter', () => {
		const compte = {
			appliquees: 45,
			erreurs: [
				{ operation: { ligne: 7, type: 'modifier', personneId: 3, champs: {} }, message: 'Prénom trop long' },
				{ operation: depart(11), message: 'Personne inconnue' }
			],
			nonTentees: [
				{ ligne: 7, type: 'modifier', personneId: 3, champs: {} },
				{ ligne: 3, type: 'equipe', personneId: 4, equipeId: null },
				{ ligne: 7, type: 'statut', personneId: 3, statut: 'suspendu' },
				depart(12)
			],
			interruption: null
		};
		const rendu = html(CompteRendu, { compte, departs: complet.departs });
		const page = texte(rendu);
		expect(rendu).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Compte rendu/);
		expect(page).toContain('45 opérations appliquées');
		expect(page).toContain('Ligne 7 : Prénom trop long');
		expect(page).toContain('Départ de Yves Yole : Personne inconnue');
		expect(page).toContain('4 opérations non tentées : ligne 3, ligne 7, départ de Xavier Xu');
		expect(page).not.toContain('Application arrêtée');
		expect(page).toContain('Réexportez avant le prochain import');
	});

	it('dit pourquoi l\'application s\'est arrêtée', () => {
		const compte = { appliquees: 0, erreurs: [], nonTentees: [depart(12)], interruption: 'connexion' };
		expect(texte(html(CompteRendu, { compte, departs: complet.departs }))).toContain('Application arrêtée : connexion perdue.');
	});
});

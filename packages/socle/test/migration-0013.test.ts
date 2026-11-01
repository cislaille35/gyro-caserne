import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const appliquer = (sqlite: DatabaseSync, fichier: string) => {
	for (const instruction of readFileSync(new URL(fichier, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(instruction);
};
const fichier0013 = migrations.find((f) => f.startsWith('0013_'))!;
const avant = (sqlite: DatabaseSync) => {
	for (const f of migrations.filter((f) => f < '0013_')) appliquer(sqlite, f);
};

describe('migration 0013', () => {
	it('base déjà remplie : les dix aptitudes du modèle métier, commandement et conduite contrôlées', () => {
		const sqlite = new DatabaseSync(':memory:');
		avant(sqlite);
		sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent');`);
		appliquer(sqlite, fichier0013);
		expect(sqlite.prepare('SELECT nom, controlee FROM aptitude ORDER BY ordre').all().map((l) => `${l.nom}:${l.controlee}`)).toEqual(['CA2:1', 'CA1:1', 'CE:1', 'COD1:1', 'COD2:1', 'INC:0', 'SAP:0', 'DIV:0', 'FDF1:0', 'FDF2:0']);
	});

	it('base vide : rien ; rejouée, pas de doublon', () => {
		const vide = new DatabaseSync(':memory:');
		avant(vide);
		appliquer(vide, fichier0013);
		expect(vide.prepare('SELECT count(*) AS n FROM aptitude').get()).toEqual({ n: 0 });

		const sqlite = new DatabaseSync(':memory:');
		avant(sqlite);
		sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent');`);
		appliquer(sqlite, fichier0013);
		const [suite] = readFileSync(new URL(fichier0013, dossier), 'utf8').split('-- Ajouté à la main').slice(1);
		for (const instruction of `--${suite}`.split('--> statement-breakpoint')) sqlite.exec(instruction);
		expect(sqlite.prepare('SELECT count(*) AS n FROM aptitude').get()).toEqual({ n: 10 });
	});
});

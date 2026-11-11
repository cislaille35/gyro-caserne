import { describe, expect, it } from 'vitest';
import { copieRestaurable, instructions, ordreDesTables, viderLaBase } from '../scripts/copie-restaurable.ts';

// Forme d'un export de D1 : les tables dans leur ordre de création, l'enfant avant le parent ici.
const tables = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE
);
CREATE TABLE \`affectation\` (
	\`personne_id\` text NOT NULL,
	\`equipe_id\` text NOT NULL,
	FOREIGN KEY (\`personne_id\`) REFERENCES \`personne\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`equipe_id\`) REFERENCES \`equipe\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE \`personne\` (\`id\` text PRIMARY KEY NOT NULL, \`equipe_id\` text REFERENCES \`equipe\`(\`id\`));
CREATE TABLE \`equipe\` (\`id\` text PRIMARY KEY NOT NULL);
CREATE INDEX \`affectation_personne\` ON \`affectation\` (\`personne_id\`);
`;

const donnees = `PRAGMA defer_foreign_keys=TRUE;
INSERT INTO "d1_migrations" ("id","name") VALUES(1,'0000_debut.sql');
INSERT INTO "affectation" ("personne_id","equipe_id") VALUES('p1','e1');
INSERT INTO "personne" ("id","equipe_id") VALUES('p1','e1');
INSERT INTO "personne" ("id","equipe_id") VALUES('p2','e1');
INSERT INTO "equipe" ("id") VALUES('e1');
`;

describe('copie restaurable', () => {
	it('découpe le SQL en instructions, sans couper une valeur qui contient ; ou un retour à la ligne', () => {
		const sql = `INSERT INTO "message" ("texte") VALUES('Bonjour ;\nça va ? L''équipe');\nINSERT INTO "message" ("texte") VALUES('fin');\n`;
		expect(instructions(sql)).toEqual([`INSERT INTO "message" ("texte") VALUES('Bonjour ;\nça va ? L''équipe')`, `INSERT INTO "message" ("texte") VALUES('fin')`]);
	});

	it('range les tables pour qu’une table vienne après celles qu’elle cite', () => {
		const ordre = ordreDesTables(tables);
		expect(ordre.indexOf('equipe')).toBeLessThan(ordre.indexOf('personne'));
		expect(ordre.indexOf('personne')).toBeLessThan(ordre.indexOf('affectation'));
		expect(ordre).toContain('d1_migrations');
	});

	it('refuse un cycle entre tables, qu’aucun ordre ne peut restaurer', () => {
		const cycle = 'CREATE TABLE `a` (`b_id` text REFERENCES `b`(`id`));\nCREATE TABLE `b` (`a_id` text REFERENCES `a`(`id`));\n';
		expect(() => ordreDesTables(cycle)).toThrow(/cycle/);
	});

	it('ignore une table qui se cite elle-même', () => {
		expect(ordreDesTables('CREATE TABLE `message` (`id` text, `reponse_a` text REFERENCES `message`(`id`));\n')).toEqual(['message']);
	});

	it('met les tables, puis les données d’une table après celles des tables qu’elle cite', () => {
		const copie = instructions(copieRestaurable(tables, donnees));
		const position = (debut: string) => copie.findIndex((i) => i.startsWith(debut));
		expect(position('CREATE INDEX')).toBeLessThan(position('INSERT'));
		expect(position('INSERT INTO "equipe"')).toBeLessThan(position('INSERT INTO "personne"'));
		expect(position('INSERT INTO "personne"')).toBeLessThan(position('INSERT INTO "affectation"'));
		expect(copie.filter((i) => i.startsWith('INSERT'))).toHaveLength(5);
	});

	it('remet les compteurs AUTOINCREMENT (sqlite_sequence) après toutes les données', () => {
		const copie = instructions(copieRestaurable(tables, `INSERT INTO "sqlite_sequence" VALUES('d1_migrations',1);\n` + donnees));
		expect(copie.at(-1)).toBe(`INSERT INTO "sqlite_sequence" VALUES('d1_migrations',1)`);
	});

	it('garde chaque valeur telle quelle', () => {
		const texte = `INSERT INTO "equipe" ("id") VALUES('e;1\n''A''');\n`;
		expect(copieRestaurable(tables, texte)).toContain(`INSERT INTO "equipe" ("id") VALUES('e;1\n''A''');`);
	});

	it('refuse des données d’une table absente des tables exportées', () => {
		expect(() => copieRestaurable(tables, `INSERT INTO "inconnue" ("id") VALUES('x');\n`)).toThrow(/inconnue/);
	});

	it('vide une base en supprimant une table avant celles qu’elle cite', () => {
		const vidage = instructions(viderLaBase(tables));
		const position = (table: string) => vidage.indexOf(`DROP TABLE IF EXISTS "${table}"`);
		expect(vidage[0]).toBe('PRAGMA defer_foreign_keys = true');
		expect(position('affectation')).toBeLessThan(position('personne'));
		expect(position('personne')).toBeLessThan(position('equipe'));
		expect(position('d1_migrations')).toBeGreaterThan(0);
	});
});

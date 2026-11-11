import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { copieRestaurable, instructions, ordreDesTables, viderLaBase } from '../scripts/copie-restaurable.ts';

// Forme d'un export complet de D1 : les tables dans leur ordre de création (l'enfant avant le parent ici),
// chacune suivie de ses données, puis les compteurs AUTOINCREMENT.
const exportD1 = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE
);
INSERT INTO "d1_migrations" ("id","name") VALUES(1,'0000_debut.sql');
INSERT INTO "d1_migrations" ("id","name") VALUES(2,'0001_suite.sql');
CREATE TABLE \`affectation\` (
	\`personne_id\` text NOT NULL,
	\`equipe_id\` text NOT NULL,
	FOREIGN KEY (\`personne_id\`) REFERENCES \`personne\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`equipe_id\`) REFERENCES \`equipe\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO "affectation" ("personne_id","equipe_id") VALUES('p1','e1');
CREATE TABLE \`personne\` (\`id\` text PRIMARY KEY NOT NULL, \`equipe_id\` text REFERENCES \`equipe\`(\`id\`), \`photo\` blob);
INSERT INTO "personne" ("id","equipe_id","photo") VALUES('p1','e1',X'00ff');
INSERT INTO "personne" ("id","equipe_id","photo") VALUES('p2','e1',NULL);
CREATE TABLE \`equipe\` (\`id\` text PRIMARY KEY NOT NULL);
INSERT INTO "equipe" ("id") VALUES('e1');
CREATE INDEX \`affectation_personne\` ON \`affectation\` (\`personne_id\`);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',5);
`;

// Comme D1 : liens contrôlés à chaque instruction, sans report sur le fichier
function charger(base: DatabaseSync, sql: string) {
	base.exec('PRAGMA foreign_keys = ON');
	for (const instruction of instructions(sql)) if (!/^PRAGMA defer/i.test(instruction)) base.exec(instruction);
}

describe('copie restaurable', () => {
	it('découpe le SQL en instructions, sans couper une valeur qui contient ; ou un retour à la ligne', () => {
		const sql = `INSERT INTO "message" ("texte") VALUES('Bonjour ;\nça va ? L''équipe');\nINSERT INTO "message" ("texte") VALUES('fin');\n`;
		expect(instructions(sql)).toEqual([`INSERT INTO "message" ("texte") VALUES('Bonjour ;\nça va ? L''équipe')`, `INSERT INTO "message" ("texte") VALUES('fin')`]);
	});

	it('ne coupe pas un identifiant qui contient un ;', () => {
		expect(instructions('CREATE TABLE `a;b` ("c;d" text);\n')).toEqual(['CREATE TABLE `a;b` ("c;d" text)']);
	});

	it('refuse un SQL tronqué', () => {
		expect(() => instructions("INSERT INTO t VALUES('ouverte);\n")).toThrow(/pas fermée/);
		expect(() => instructions('INSERT INTO t VALUES(1)')).toThrow(/pas de « ; »/);
	});

	it('range les tables pour qu’une table vienne après celles qu’elle cite', () => {
		const ordre = ordreDesTables(exportD1);
		expect(ordre.indexOf('equipe')).toBeLessThan(ordre.indexOf('personne'));
		expect(ordre.indexOf('personne')).toBeLessThan(ordre.indexOf('affectation'));
		expect(ordre).toContain('d1_migrations');
	});

	it('lit aussi les liens écrits en minuscules', () => {
		const ordre = ordreDesTables('create table `b` (`a_id` text references `a`(`id`));\ncreate table `a` (`id` text);\n');
		expect(ordre).toEqual(['a', 'b']);
	});

	it('refuse un cycle entre tables, qu’aucun ordre ne peut restaurer', () => {
		const cycle = 'CREATE TABLE `a` (`b_id` text REFERENCES `b`(`id`));\nCREATE TABLE `b` (`a_id` text REFERENCES `a`(`id`));\n';
		expect(() => ordreDesTables(cycle)).toThrow(/cycle/);
	});

	it('ignore une table qui se cite elle-même', () => {
		expect(ordreDesTables('CREATE TABLE `message` (`id` text, `reponse_a` text REFERENCES `message`(`id`));\n')).toEqual(['message']);
	});

	it('met les tables, puis les données d’une table après celles des tables qu’elle cite, puis les compteurs', () => {
		const copie = instructions(copieRestaurable(exportD1));
		const position = (debut: string) => copie.findIndex((i) => i.startsWith(debut));
		expect(position('CREATE INDEX')).toBeLessThan(position('INSERT'));
		expect(position('INSERT INTO "equipe"')).toBeLessThan(position('INSERT INTO "personne"'));
		expect(position('INSERT INTO "personne"')).toBeLessThan(position('INSERT INTO "affectation"'));
		expect(copie.slice(-2)).toEqual(['DELETE FROM sqlite_sequence', `INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',5)`]);
		expect(copie.filter((i) => i.startsWith('INSERT'))).toHaveLength(7);
		expect(copie.filter((i) => i.startsWith('PRAGMA'))).toEqual(['PRAGMA defer_foreign_keys = true']);
	});

	it('se recharge dans une base qui contrôle les liens à chaque instruction, compteurs compris', () => {
		const base = new DatabaseSync(':memory:');
		expect(() => charger(new DatabaseSync(':memory:'), exportD1)).toThrow();
		charger(base, copieRestaurable(exportD1));
		expect(base.prepare('SELECT count(*) AS n FROM personne').get()).toEqual({ n: 2 });
		expect(base.prepare("SELECT hex(photo) AS h FROM personne WHERE id = 'p1'").get()).toEqual({ h: '00FF' });
		// Le compteur exporté (5) est gardé, pas recalculé sur le plus grand id (2) : un id effacé n'est jamais réutilisé
		base.exec("INSERT INTO d1_migrations (name) VALUES ('0002_nouvelle.sql')");
		expect(base.prepare("SELECT id FROM d1_migrations WHERE name = '0002_nouvelle.sql'").get()).toEqual({ id: 6 });
	});

	it('garde chaque valeur telle quelle', () => {
		const avecValeur = exportD1.replace("VALUES('e1');", `VALUES('e;1\n''A''');`);
		expect(copieRestaurable(avecValeur)).toContain(`INSERT INTO "equipe" ("id") VALUES('e;1\n''A''');`);
	});

	it('laisse de côté les statistiques de l’optimiseur', () => {
		expect(copieRestaurable(exportD1 + `INSERT INTO "sqlite_stat1" VALUES('equipe',NULL,'1');\n`)).not.toContain('sqlite_stat1');
	});

	it('refuse des données d’une table absente, ou une instruction inattendue', () => {
		expect(() => copieRestaurable(exportD1 + `INSERT INTO "inconnue" ("id") VALUES('x');\n`)).toThrow(/inconnue/);
		expect(() => copieRestaurable(exportD1 + `UPDATE equipe SET id = 'x';\n`)).toThrow(/inattendue/);
	});

	it('vide une base en supprimant une table avant celles qu’elle cite, sans toucher aux tables internes', () => {
		const vidage = instructions(viderLaBase(exportD1 + 'CREATE TABLE _cf_KV (cle text);\n'));
		const position = (table: string) => vidage.indexOf(`DROP TABLE IF EXISTS "${table}"`);
		expect(vidage[0]).toBe('PRAGMA defer_foreign_keys = true');
		expect(position('affectation')).toBeLessThan(position('personne'));
		expect(position('personne')).toBeLessThan(position('equipe'));
		expect(position('d1_migrations')).toBeGreaterThan(0);
		expect(vidage.join()).not.toMatch(/_cf_KV|sqlite_/);
	});

	it('vide puis recharge la même base', () => {
		const base = new DatabaseSync(':memory:');
		charger(base, copieRestaurable(exportD1));
		charger(base, viderLaBase(exportD1));
		expect(base.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get()).toEqual({ n: 0 });
		charger(base, copieRestaurable(exportD1));
		expect(base.prepare('SELECT count(*) AS n FROM affectation').get()).toEqual({ n: 1 });
	});
});

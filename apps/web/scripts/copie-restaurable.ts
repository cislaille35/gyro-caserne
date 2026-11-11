// Rend la copie de la base restaurable dans D1 (copie hebdomadaire, décision 0029).
// L'export de D1 suit l'ordre de création des tables : une table y est remplie avant celle qu'elle cite, et D1 refuse
// (« no such table », « FOREIGN KEY constraint failed »). On remet les tables d'abord, puis les données, chaque table après
// celles qu'elle cite. Aucune donnée n'est affichée, sauf dans la sortie demandée.
// Usage : node scripts/copie-restaurable.ts <tables.sql> <donnees.sql> > copie.sql
//         node scripts/copie-restaurable.ts --vider <tables.sql> > vider.sql (supprime les tables, chacune avant celles qu'elle cite)
import { readFileSync } from 'node:fs';

// Découpe à chaque « ; » hors des chaînes ('…', "…", `…`), qui peuvent contenir des ; et des retours à la ligne.
export function instructions(sql: string): string[] {
	const liste: string[] = [];
	let debut = 0;
	let guillemet = '';
	for (let i = 0; i < sql.length; i++) {
		const c = sql[i];
		if (guillemet) {
			if (c === guillemet) guillemet = '';
		} else if (c === "'" || c === '"' || c === '`') {
			guillemet = c;
		} else if (c === ';') {
			liste.push(sql.slice(debut, i).trim());
			debut = i + 1;
		}
	}
	if (guillemet) throw new Error('SQL incomplet : une chaîne n’est pas fermée');
	if (sql.slice(debut).trim()) throw new Error('SQL incomplet : la dernière instruction n’a pas de « ; »');
	return liste.filter(Boolean);
}

const nomDeTable = /^CREATE TABLE (?:IF NOT EXISTS )?[`"]?([^`"\s(]+)/;
const nomInsere = /^INSERT INTO [`"]?([^`"\s(]+)/;

// Chaque table, avec les tables qu'elle cite (hors elle-même), dans l'ordre de l'export
function tablesCitees(tables: string): Map<string, string[]> {
	const liens = new Map<string, string[]>();
	for (const instruction of instructions(tables)) {
		const nom = instruction.match(nomDeTable)?.[1];
		if (!nom) continue;
		const citees = [...instruction.matchAll(/REFERENCES [`"]?([^`"\s(]+)/g)].map((m) => m[1]).filter((t) => t !== nom);
		liens.set(nom, [...new Set(citees)]);
	}
	return liens;
}

// Les tables, chacune après celles qu'elle cite
export function ordreDesTables(tables: string): string[] {
	const liens = tablesCitees(tables);
	const ordre: string[] = [];
	const enCours = new Set<string>();
	const visiter = (table: string) => {
		if (ordre.includes(table)) return;
		if (enCours.has(table)) throw new Error(`Restauration impossible : cycle entre tables (${[...enCours, table].join(' → ')})`);
		enCours.add(table);
		for (const citee of liens.get(table) ?? []) if (liens.has(citee)) visiter(citee);
		enCours.delete(table);
		ordre.push(table);
	};
	for (const table of liens.keys()) visiter(table);
	return ordre;
}

export function copieRestaurable(tables: string, donnees: string): string {
	// sqlite_sequence (compteurs des clés AUTOINCREMENT) existe dès que sa table est créée : remplie en dernier
	const parTable = new Map([...ordreDesTables(tables), 'sqlite_sequence'].map((t) => [t, [] as string[]]));
	for (const instruction of instructions(donnees)) {
		if (/^PRAGMA /i.test(instruction)) continue;
		const nom = instruction.match(nomInsere)?.[1];
		if (!nom) throw new Error('Instruction inattendue dans les données exportées (non affichée)');
		const lignes = parTable.get(nom);
		if (!lignes) throw new Error(`Données d’une table absente des tables exportées : ${nom}`);
		lignes.push(instruction);
	}
	const schema = instructions(tables).filter((i) => !/^PRAGMA /i.test(i));
	return [...schema, 'PRAGMA defer_foreign_keys = true', ...[...parTable.values()].flat()].map((i) => `${i};\n`).join('');
}

export function viderLaBase(tables: string): string {
	const suppressions = ordreDesTables(tables)
		.filter((t) => !t.startsWith('_cf_') && !t.startsWith('sqlite_'))
		.reverse()
		.map((t) => `DROP TABLE IF EXISTS "${t}"`);
	return ['PRAGMA defer_foreign_keys = true', ...suppressions].map((i) => `${i};\n`).join('');
}

if (import.meta.main) {
	const [premier, second] = process.argv.slice(2);
	const lire = (chemin: string | undefined) => {
		if (!chemin) throw new Error('Usage : copie-restaurable.ts <tables.sql> <donnees.sql>, ou --vider <tables.sql>');
		return readFileSync(chemin, 'utf8');
	};
	process.stdout.write(premier === '--vider' ? viderLaBase(lire(second)) : copieRestaurable(lire(premier), lire(second)));
}

// Rend la copie de la base restaurable dans D1 (copie hebdomadaire, décision 0030).
// L'export de D1 suit l'ordre de création des tables : une table y est remplie avant celle qu'elle cite, et D1 refuse
// (« no such table », « FOREIGN KEY constraint failed »), car il ne diffère pas ce contrôle sur tout un fichier. On remet
// les tables d'abord, puis les données, chaque table après celles qu'elle cite, et les compteurs AUTOINCREMENT à la fin.
// Aucune donnée n'est affichée, sauf dans la sortie demandée. L'export de D1 n'a pas de commentaires SQL (-- ou /* */) :
// le découpage ne les gère pas.
// Usage : node scripts/copie-restaurable.ts <export.sql> > copie.sql
//         node scripts/copie-restaurable.ts --vider <export.sql> > vider.sql (supprime les tables, chacune avant celles qu'elle cite)
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

const nomDeTable = /^CREATE TABLE (?:IF NOT EXISTS )?[`"]?([^`"\s(]+)/i;
const nomInsere = /^INSERT INTO [`"]?([^`"\s(]+)/i;

// Chaque table, avec les tables qu'elle cite (hors elle-même), dans l'ordre de l'export
function tablesCitees(tables: string): Map<string, string[]> {
	const liens = new Map<string, string[]>();
	for (const instruction of instructions(tables)) {
		const nom = instruction.match(nomDeTable)?.[1];
		if (!nom) continue;
		const citees = [...instruction.matchAll(/REFERENCES [`"]?([^`"\s(]+)/gi)].map((m) => m[1]).filter((t) => t !== nom);
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

export function copieRestaurable(exportD1: string): string {
	const schema: string[] = [];
	const parTable = new Map(ordreDesTables(exportD1).map((t) => [t, [] as string[]]));
	// Compteurs des clés AUTOINCREMENT : chaque INSERT les remplit déjà ; on les efface puis on remet ceux de l'export, en dernier.
	const compteurs: string[] = [];
	for (const instruction of instructions(exportD1)) {
		const nom = instruction.match(nomInsere)?.[1];
		if (/^PRAGMA /i.test(instruction)) continue;
		else if (/^CREATE /i.test(instruction)) schema.push(instruction);
		else if (/^DELETE FROM [`"]?sqlite_sequence[`"]?$/i.test(instruction) || nom === 'sqlite_sequence') compteurs.push(instruction);
		// Statistiques de l'optimiseur (après un ANALYZE) : recalculables, et leur table n'existe pas dans une base neuve
		else if (nom === 'sqlite_stat1') continue;
		else if (nom && parTable.has(nom)) parTable.get(nom)!.push(instruction);
		else if (nom) throw new Error(`Données d’une table absente des tables exportées : ${nom}`);
		else throw new Error('Instruction inattendue dans l’export (non affichée)');
	}
	if (compteurs.length && !/^DELETE/i.test(compteurs[0])) compteurs.unshift('DELETE FROM sqlite_sequence');
	return [...schema, 'PRAGMA defer_foreign_keys = true', ...[...parTable.values()].flat(), ...compteurs].map((i) => `${i};\n`).join('');
}

export function viderLaBase(exportD1: string): string {
	const suppressions = ordreDesTables(exportD1)
		.filter((t) => !t.startsWith('_cf_') && !t.startsWith('sqlite_'))
		.reverse()
		.map((t) => `DROP TABLE IF EXISTS "${t}"`);
	return ['PRAGMA defer_foreign_keys = true', ...suppressions].map((i) => `${i};\n`).join('');
}

if (import.meta.main) {
	const [premier, second] = process.argv.slice(2);
	const lire = (chemin: string | undefined) => {
		if (!chemin) throw new Error('Usage : copie-restaurable.ts <export.sql>, ou --vider <export.sql>');
		return readFileSync(chemin, 'utf8');
	};
	process.stdout.write(premier === '--vider' ? viderLaBase(lire(second)) : copieRestaurable(lire(premier)));
}

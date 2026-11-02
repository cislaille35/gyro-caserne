import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { creerBaseD1, instruction } from '../src/base.ts';

// Un faux D1 qui garde ce que le batch lui envoie.
function fauxD1() {
	const envoyes: { sql: string; valeurs: unknown[] }[][] = [];
	const preparer = (texte: string) => {
		const stmt = { sql: texte, valeurs: [] as unknown[], bind: (...v: unknown[]) => ({ ...stmt, valeurs: v }) };
		return stmt;
	};
	const d1 = { prepare: preparer, batch: async (lot: { sql: string; valeurs: unknown[] }[]) => (envoyes.push(lot), lot.map(() => ({ results: [], success: true, meta: {} }))) };
	return { d1: d1 as unknown as D1Database, envoyes };
}

describe('instruction brute dans un batch D1', () => {
	it('préparée et liée à ses paramètres (sinon le batch échoue)', async () => {
		const { d1, envoyes } = fauxD1();
		const base = creerBaseD1(d1);
		await expect(base.batch([base.run(sql`UPDATE x SET a = ${1}`)])).rejects.toThrow();
		await base.batch([instruction(base, sql`UPDATE x SET a = ${1}`)]);
		expect(envoyes[0]).toEqual([expect.objectContaining({ sql: 'UPDATE x SET a = ?', valeurs: [1] })]);
	});
});

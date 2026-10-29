import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migration = (prefixe: string) => {
	const fichier = readdirSync(dossier).find((f) => f.startsWith(prefixe) && f.endsWith('.sql'));
	if (!fichier) throw new Error(`migration ${prefixe} introuvable`);
	return readFileSync(new URL(fichier, dossier), 'utf8');
};
const appliquer = (sqlite: DatabaseSync, contenu: string) => {
	for (const instruction of contenu.split('--> statement-breakpoint')) sqlite.exec(instruction);
};

// Préprod seulement, données fictives : les photos de démonstration sont perdues (décision du porteur, 2026-10-29).
describe('migration 0006', () => {
	it('sur une base en 0005 : la table des photos est refaite, sans octets, avec la référence photo_id ; la publication et ses gestes restent', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const prefixe of ['0000_', '0001_', '0002_', '0003_', '0004_', '0005_']) appliquer(sqlite, migration(prefixe));
		sqlite.exec(`INSERT INTO publication (mur, auteur, type, texte, cree_le) VALUES ('vie', 'personne:1', 'message', 'Bonjour', '2026-10-28T10:00');`);
		sqlite.exec(`INSERT INTO photo_publication (publication_id, ordre, type, donnees) VALUES (1, 0, 'image/jpeg', x'ffd8ff');`);
		sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent');`);
		sqlite.exec(`INSERT INTO personne (email, prenom, nom, profil_id) VALUES ('alice@exemple.fr', 'Alice', 'Test', 1);`);
		sqlite.exec(`INSERT INTO commentaire (publication_id, auteur, texte, cree_le) VALUES (1, 'personne:1', 'Bravo', '2026-10-28T10:05');`);
		sqlite.exec(`INSERT INTO jaime (publication_id, personne_id) VALUES (1, 1);`);
		sqlite.exec(`INSERT INTO vote_sondage (publication_id, personne_id, reponse) VALUES (1, 1, 0);`);
		appliquer(sqlite, migration('0006_'));
		expect(sqlite.prepare('SELECT texte FROM publication').all()).toEqual([{ texte: 'Bonjour' }]);
		expect(sqlite.prepare('SELECT publication_id, texte FROM commentaire').all()).toEqual([{ publication_id: 1, texte: 'Bravo' }]);
		expect(sqlite.prepare('SELECT publication_id, personne_id FROM jaime').all()).toEqual([{ publication_id: 1, personne_id: 1 }]);
		expect(sqlite.prepare('SELECT publication_id, personne_id, reponse FROM vote_sondage').all()).toEqual([{ publication_id: 1, personne_id: 1, reponse: 0 }]);
		expect(sqlite.prepare('SELECT * FROM photo_publication').all()).toEqual([]);
		const colonnes = sqlite.prepare('PRAGMA table_info(photo_publication)').all() as { name: string; notnull: number }[];
		expect(colonnes.map((c) => c.name)).toEqual(['id', 'publication_id', 'ordre', 'type', 'photo_id']);
		expect(colonnes.find((c) => c.name === 'photo_id')!.notnull).toBe(1);
		// Le contrôle du type, le lien vers la publication et l'index restent.
		sqlite.exec(`INSERT INTO photo_publication (publication_id, ordre, type, photo_id) VALUES (1, 0, 'image/webp', 7);`);
		expect(() => sqlite.exec(`INSERT INTO photo_publication (publication_id, ordre, type, photo_id) VALUES (1, 1, 'image/png', 8);`)).toThrow();
		expect(() => sqlite.exec(`INSERT INTO photo_publication (publication_id, ordre, type, photo_id) VALUES (99, 1, 'image/jpeg', 8);`)).toThrow();
		expect(sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'photo_publication'`).all()).toEqual([{ name: 'photo_publication_publication' }]);
		sqlite.exec('DELETE FROM publication');
		expect(sqlite.prepare('SELECT * FROM photo_publication').all()).toEqual([]);
	});
});

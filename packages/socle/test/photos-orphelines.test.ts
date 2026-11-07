import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { enregistrerEngin } from '../src/engins.ts';
import { lireFiche } from '../src/fiches.ts';
import { effacerPhotosOrphelines, FENETRE_ORPHELINES } from '../src/photos-orphelines.ts';
import { commencerPrise, gestePrise } from '../src/prises.ts';
import { anomalie, conversation, message, photoMessage, photoPublication, publication, signalementMessage } from '../src/schema.ts';
import { photo as octets } from '../src/schema-photos.ts';
import { jeuEngins } from './de-test-engins.ts';

const reglage = centreExemple.astreinte;
// La nuit du ménage (3 h 30) ; une photo d'avant-hier est assez vieille, une d'hier soir non.
const NUIT = '2026-11-10T03:30';
const VIEILLE = '2026-10-01T10:00';
const jpeg = () => ({ type: 'image/jpeg' as const, donnees: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) });

async function jeu() {
	const j = await jeuEngins();
	const ajouter = async (n: number, creeLe = VIEILLE) =>
		(await j.base.photos.insert(octets).values(Array.from({ length: n }, () => ({ type: 'image/jpeg' as const, donnees: new Uint8Array([1]), taille: 1, creeLe }))).returning({ id: octets.id })).map((p) => p.id);
	const restantes = async () => (await j.base.photos.select({ id: octets.id }).from(octets)).map((p) => p.id);
	return { ...j, ajouter, restantes };
}

describe('ménage des photos orphelines (tâche de nuit)', () => {
	it('efface une photo que plus rien ne référence ; garde celles d’une publication, d’un message, d’une anomalie, d’une prise de garde, d’un signalement non classé', async () => {
		const j = await jeu();
		const moi = (j.alice as { id: number }).id;
		const [orpheline, dePublication, deMessage, dAnomalie, deSignalement] = await j.ajouter(5);
		const [pub] = await j.base.insert(publication).values({ mur: 'centre', auteur: `personne:${moi}`, type: 'message', texte: 'Photo', creeLe: VIEILLE }).returning();
		await j.base.insert(photoPublication).values({ publicationId: pub!.id, ordre: 0, type: 'image/jpeg', photoId: dePublication! });
		const [conv] = await j.base.insert(conversation).values({ type: 'groupe', nom: 'Garde', creePar: moi, creeLe: VIEILLE, dernierLe: VIEILLE }).returning();
		const [msg] = await j.base.insert(message).values({ conversationId: conv!.id, auteur: moi, texte: '', creeLe: VIEILLE, majLe: VIEILLE }).returning();
		await j.base.insert(photoMessage).values({ messageId: msg!.id, ordre: 0, type: 'image/jpeg', photoId: deMessage! });
		const vsav = await enregistrerEngin(j.base, j.referent, { nom: 'VSAV 1', immatriculation: '', typeId: j.types.VSAV, situation: 'centre', provenance: '' }, VIEILLE);
		await j.base.insert(anomalie).values({ enginId: vsav, zone: '', libelle: 'Treuil', genre: 'abime', photoId: dAnomalie!, signaleePar: moi, signaleeLe: VIEILLE });
		// Le message signalé est effacé : la copie du signalement, non classé, garde la photo.
		await j.base.insert(signalementMessage).values({ messageId: null, par: moi, le: VIEILLE, auteur: moi, envoyeLe: VIEILLE, texteCopie: 'x', photosCopie: JSON.stringify([deSignalement]) });
		// Une prise de garde en cours, avec la photo d'un écart, vieillie.
		const fiche = await lireFiche(j.base, j.types.VSAV);
		const element = fiche.zones[0]!.elements[0]!;
		// Pendant la relève du vendredi 30 octobre (réglage d'exemple).
		const releve = '2026-10-30T18:10';
		const prise = await commencerPrise(j.base, j.base.photos, j.alice, vsav, releve, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, prise, { quoi: 'ecart', element: element.ref, genre: 'manquant', manque: 1, note: '', photo: jpeg() }, releve, reglage);
		const [dePrise] = (await j.restantes()).filter((id) => id > deSignalement!);
		await j.base.photos.update(octets).set({ creeLe: VIEILLE });

		expect(await effacerPhotosOrphelines(j.base, j.base.photos, NUIT)).toBe(1);
		expect(await j.restantes()).toEqual([dePublication, deMessage, dAnomalie, deSignalement, dePrise]);
		expect(orpheline).toBeDefined();
	});

	it('la copie d’un signalement classé ne protège plus sa photo', async () => {
		const j = await jeu();
		const moi = (j.alice as { id: number }).id;
		const [id] = await j.ajouter(1);
		await j.base.insert(signalementMessage).values({ messageId: null, par: moi, le: VIEILLE, auteur: moi, envoyeLe: VIEILLE, texteCopie: '', photosCopie: JSON.stringify([id]), classeLe: VIEILLE });
		expect(await effacerPhotosOrphelines(j.base, j.base.photos, NUIT)).toBe(1);
		expect(await j.restantes()).toEqual([]);
	});

	it('garde une photo de moins d’un jour, même sans référence : une publication peut être en cours d’envoi', async () => {
		const j = await jeu();
		const [recente] = await j.ajouter(1, '2026-11-09T22:00');
		const [ancienne] = await j.ajouter(1, '2026-11-08T23:59');
		expect(await effacerPhotosOrphelines(j.base, j.base.photos, NUIT)).toBe(1);
		expect(await j.restantes()).toEqual([recente]);
		expect(ancienne).toBeDefined();
	});

	it(`examine ${FENETRE_ORPHELINES} identifiants par nuit au plus, une tranche d’après le jour ; 4 requêtes au plus, 100 paramètres au plus`, async () => {
		const j = await jeu();
		const ids = await j.ajouter(450);
		// Référencées, aux deux bouts de la deuxième tranche : gardées.
		const moi = (j.alice as { id: number }).id;
		await j.base.insert(signalementMessage).values({ messageId: null, par: moi, le: VIEILLE, auteur: moi, envoyeLe: VIEILLE, texteCopie: 'x', photosCopie: JSON.stringify([201, 400]) });
		j.base.parametresMax = 0;
		const effacees: number[] = [];
		// Trois tranches ; la dernière vidée, il en reste deux : une nuit de plus.
		for (const nuit of ['2026-11-10T03:30', '2026-11-11T03:30', '2026-11-12T03:30', '2026-11-13T03:30']) {
			const requetes = j.base.requetes;
			effacees.push(await effacerPhotosOrphelines(j.base, j.base.photos, nuit));
			expect(j.base.requetes - requetes).toBeLessThanOrEqual(4);
		}
		expect(effacees).toEqual([198, 50, 0, 200]);
		expect(effacees.reduce((a, b) => a + b)).toBe(ids.length - 2);
		expect(await j.restantes()).toEqual([201, 400]);
		expect(j.base.parametresMax).toBeLessThanOrEqual(100);
	});

	it('rien dans la base des photos : une requête ; rien d’orphelin : trois, sans effacement', async () => {
		const j = await jeu();
		let requetes = j.base.requetes;
		expect(await effacerPhotosOrphelines(j.base, j.base.photos, NUIT)).toBe(0);
		expect(j.base.requetes - requetes).toBe(1);
		const [id] = await j.ajouter(1);
		await j.base.insert(signalementMessage).values({ messageId: null, par: (j.alice as { id: number }).id, le: VIEILLE, auteur: (j.alice as { id: number }).id, envoyeLe: VIEILLE, texteCopie: 'x', photosCopie: JSON.stringify([id]) });
		requetes = j.base.requetes;
		expect(await effacerPhotosOrphelines(j.base, j.base.photos, NUIT)).toBe(0);
		expect(j.base.requetes - requetes).toBe(3);
	});

	it('refuse une date mal formée', async () => {
		const j = await jeu();
		await expect(effacerPhotosOrphelines(j.base, j.base.photos, '2026-11-10')).rejects.toThrow();
	});
});

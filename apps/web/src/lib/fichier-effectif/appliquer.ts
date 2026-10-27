import type { Operation } from '@gyro-caserne/socle';

export type Envoyer = (operation: Operation, nouvelles: Record<number, number>) => Promise<{ personneId: number | null }>;
export type CompteRendu = { appliquees: number; erreurs: { operation: Operation; message: string }[]; sautees: number };

// Envoie les opérations une à une. Une erreur saute la suite de sa ligne ; la ligne 0 (départs d'absents) n'en a pas.
export async function appliquerTout(operations: Operation[], envoyer: Envoyer, avancer?: (fait: number) => void): Promise<CompteRendu> {
	const compte: CompteRendu = { appliquees: 0, erreurs: [], sautees: 0 };
	const nouvelles: Record<number, number> = {};
	const enEchec = new Set<number>();
	let fait = 0;
	for (const operation of operations) {
		if (operation.ligne !== 0 && enEchec.has(operation.ligne)) {
			compte.sautees++;
		} else {
			try {
				const { personneId } = await envoyer(operation, nouvelles);
				if (operation.type === 'ajouter' && personneId !== null) nouvelles[operation.ligne] = personneId;
				compte.appliquees++;
			} catch (erreur) {
				compte.erreurs.push({ operation, message: erreur instanceof Error ? erreur.message : String(erreur) });
				enEchec.add(operation.ligne);
			}
		}
		avancer?.(++fait);
	}
	return compte;
}

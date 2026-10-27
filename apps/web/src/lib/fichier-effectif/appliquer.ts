import type { Operation } from '@gyro-caserne/socle';

// Le serveur n'a pas répondu : l'opération a pu être appliquée ou non.
export class ConnexionPerdue extends Error {
	constructor() {
		super('Connexion perdue : cette opération a peut-être été appliquée. Réexportez pour vérifier.');
		this.name = 'ConnexionPerdue';
	}
}

export type Envoyer = (operation: Operation, nouvelles: Record<number, number>) => Promise<{ personneId: number | null }>;
export type CompteRendu = {
	appliquees: number;
	erreurs: { operation: Operation; message: string }[];
	nonTentees: Operation[];
	interruption: 'connexion' | 'abandon' | null;
};

const PERTES_AVANT_ARRET = 3;

// Envoie les opérations une à une. Une erreur saute la suite de sa ligne ; la ligne 0 (départs d'absents) n'en a pas.
// Tout s'arrête après 3 connexions perdues de suite, ou quand `signal` est levé (page quittée).
export async function appliquerTout(operations: Operation[], envoyer: Envoyer, { avancer, signal }: { avancer?: (fait: number) => void; signal?: AbortSignal } = {}): Promise<CompteRendu> {
	const compte: CompteRendu = { appliquees: 0, erreurs: [], nonTentees: [], interruption: null };
	const nouvelles: Record<number, number> = {};
	const enEchec = new Set<number>();
	let pertes = 0;
	let fait = 0;
	for (const operation of operations) {
		if (signal?.aborted && !compte.interruption) compte.interruption = 'abandon';
		if (compte.interruption || (operation.ligne !== 0 && enEchec.has(operation.ligne))) {
			compte.nonTentees.push(operation);
		} else {
			try {
				const { personneId } = await envoyer(operation, nouvelles);
				if (operation.type === 'ajouter' && personneId !== null) nouvelles[operation.ligne] = personneId;
				compte.appliquees++;
				pertes = 0;
			} catch (erreur) {
				compte.erreurs.push({ operation, message: erreur instanceof Error ? erreur.message : String(erreur) });
				enEchec.add(operation.ligne);
				pertes = erreur instanceof ConnexionPerdue ? pertes + 1 : 0;
				if (pertes === PERTES_AVANT_ARRET) compte.interruption = 'connexion';
			}
		}
		avancer?.(++fait);
	}
	return compte;
}

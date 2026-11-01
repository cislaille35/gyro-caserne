import { eq, inArray } from 'drizzle-orm';
import type { Base } from '../base.ts';
import type { Reglage } from '../planning/calendrier.ts';
import { aptitude, aptitudeAgent, demandeRemplacement, personne } from '../schema.ts';
import { lireContexte, mesTranches } from './contexte.ts';
import { demanderRemplacement } from './demandes.ts';

// Données fictives seulement (développement local, préprod). Relançable, sans doublon.

// Des aptitudes, par prénom : personnes fictives et comptes de test.
const APTITUDES: Record<string, string[]> = {
	Alice: ['CA1', 'COD1', 'SAP'],
	Bruno: ['CE', 'INC'],
	Chloé: ['CA2', 'COD2', 'FDF1'],
	David: ['SAP', 'DIV'],
	Claire: ['CA2', 'CA1', 'CE'],
	Élodie: ['CA1', 'CE', 'COD1'],
	Thomas: ['COD1', 'SAP', 'INC'],
	Romain: ['CE', 'SAP'],
	Manon: ['SAP'],
	Erwan: ['COD1', 'COD2']
};

export async function chargerAptitudesFictives(base: Base, maintenant: string): Promise<void> {
	const [personnes, aptitudes] = await base.batch([
		base.select({ id: personne.id, prenom: personne.prenom }).from(personne).where(inArray(personne.prenom, Object.keys(APTITUDES))),
		base.select({ id: aptitude.id, nom: aptitude.nom }).from(aptitude)
	]);
	const lignes = personnes.flatMap((p) =>
		(APTITUDES[p.prenom] ?? []).flatMap((nom) => {
			const a = aptitudes.find((x) => x.nom === nom);
			return a ? [{ personneId: p.id, aptitudeId: a.id, obtenueLe: `${Number(maintenant.slice(0, 4)) - 3}-06-01` }] : [];
		})
	);
	if (lignes.length > 0) await base.insert(aptitudeAgent).values(lignes).onConflictDoNothing();
}

// Les aptitudes, et une demande ouverte de David (équipe 1) sur sa prochaine nuit libre, s'il n'en a aucune.
export async function chargerRemplacementsFictifs(base: Base, maintenant: string, reglage: Reglage): Promise<void> {
	await chargerAptitudesFictives(base, maintenant);
	const [david] = await base.select({ id: personne.id }).from(personne).where(eq(personne.email, 'david.leroy@exemple.fr'));
	if (!david) return;
	const deja = await base.select({ id: demandeRemplacement.id }).from(demandeRemplacement).where(eq(demandeRemplacement.demandeurId, david.id));
	if (deja.length > 0) return;
	const ctx = await lireContexte(base, maintenant, reglage);
	const nuit = mesTranches(ctx, david.id)
		.flatMap((s) => s.tranches)
		.find((t) => !t.prise && t.debut.slice(11) === '18:00' && t.debut > `${maintenant.slice(0, 10)}T23:59`);
	if (nuit) await demanderRemplacement(base, { type: 'personne', id: david.id }, { periodes: [{ debut: nuit.debut, fin: nuit.fin }], cibleId: null, mot: 'Repas de famille' }, maintenant, reglage);
}

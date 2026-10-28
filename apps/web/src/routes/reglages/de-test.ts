import { eq } from 'drizzle-orm';
import centre from '$centre';
import { attribuer, chargerJeuDeDepart, comite, personne, profil, profilDroit, responsabilite, responsabiliteDroit } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';

// Jeu commun aux tests des réglages : un référent technique, un chef de centre, un agent ordinaire.
export const super_ = { type: 'super', email: 'admin@exemple.fr' } as const;

export async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const aujourdhui = aujourdhuiParis();
	const donner = async (email: string, nomResp?: string, perimetre: { type: 'centre' } | { type: 'comite'; id: number } = { type: 'centre' }) => {
		const [p] = await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning();
		if (nomResp) {
			const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nomResp));
			await attribuer(base, super_, { personneId: p!.id, responsabiliteId: r!.id, perimetre, debut: '2026-01-01' }, aujourdhui);
		}
		return { type: 'personne', id: p!.id } as const;
	};
	const referent = await donner('ref@exemple.fr', 'Référent technique');
	const chef = await donner('chef@exemple.fr', 'Chef de centre');
	const ordinaire = await donner('agent@exemple.fr');
	const resp = async (nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!;
	const com = async (nom: string) => (await base.select().from(comite).where(eq(comite.nom, nom)))[0]!;
	const droitsDe = async (id: number) => (await base.select().from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, id))).map((l) => l.droit).sort();
	const droitsProfil = async (id: number) => (await base.select().from(profilDroit).where(eq(profilDroit.profilId, id))).map((l) => l.droit).sort();
	return { base, donner, referent, chef, ordinaire, resp, com, droitsDe, droitsProfil, profilAgent: agent!, aujourdhui };
}

export const locaux = (base: unknown, acteur: unknown) => ({ base, acteur });

// Appelle une action comme SvelteKit : formulaire encodé, paramètres de route.
export function envoyer(actions: Record<string, unknown>, nom: string, locals: unknown, corps: [string, string][], params: Record<string, string> = {}) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (actions[nom] as any)({ locals, params, url: new URL('http://x/'), request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const charger = (load: unknown, locals: unknown, params: Record<string, string> = {}, url = 'http://x/') => (load as any)({ locals, params, url: new URL(url) });

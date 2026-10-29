import { eq } from 'drizzle-orm';
import centre from '$centre';
import { affectationEquipe, attribution, chargerJeuDeDepart, equipe, personne, profil, responsabilite } from '@gyro-caserne/socle';
import { baseDeTest } from '@gyro-caserne/socle/base-de-test';

// Jeu commun aux tests des échanges : un chef de centre, un agent de l'équipe 1, un agent de l'équipe 2.
export async function preparer() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centre);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const nouvelle = async (prenom: string, equipeId?: number) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning();
		if (equipeId) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId, debut: '2026-01-01' });
		return { type: 'personne', id: p!.id } as const;
	};
	const chef = await nouvelle('Chef');
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const e1 = equipes[0]!;
	const e2 = equipes[1]!;
	const alice = await nouvelle('Alice', e1.id);
	const bruno = await nouvelle('Bruno', e2.id);
	return { base, chef, alice, bruno, e1, e2 };
}

export const locaux = (base: { photos: unknown }, acteur: unknown) => ({ base, basePhotos: base.photos, acteur });

// Un envoi de formulaire tel que le navigateur le fait : plusieurs parties (photos comprises), avec sa longueur.
// `enTetes` : par exemple celui que SvelteKit ajoute aux envois faits avec JavaScript (`x-sveltekit-action`).
export async function requeteFormulaire(corps: [string, string | File][], enTetes: Record<string, string> = {}) {
	const formulaire = new FormData();
	for (const [cle, valeur] of corps) formulaire.append(cle, valeur);
	const brouillon = new Request('http://x', { method: 'POST', body: formulaire });
	const octets = await brouillon.arrayBuffer();
	return new Request('http://x', { method: 'POST', body: octets, headers: { ...enTetes, 'content-type': brouillon.headers.get('content-type')!, 'content-length': String(octets.byteLength) } });
}

// Une action comme SvelteKit l'appelle, avec les paramètres de route.
export async function envoyer(actions: Record<string, unknown>, nom: string, locals: unknown, mur: string, corps: [string, string | File][]) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (actions[nom] as any)({ locals, params: { mur }, url: new URL(`http://x/echanges/${mur}`), request: await requeteFormulaire(corps) });
}

// Un fichier JPEG fictif (les premiers octets suffisent au contrôle).
export function jpeg(taille = 1000, nom = 'photo.jpg') {
	const octets = new Uint8Array(taille);
	octets.set([0xff, 0xd8, 0xff, 0xe0]);
	return new File([octets], nom, { type: 'image/jpeg' });
}

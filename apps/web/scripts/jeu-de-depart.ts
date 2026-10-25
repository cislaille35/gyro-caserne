// Développement : remplit la base locale du centre (CENTRE, « exemple » par défaut) avec le jeu de départ
// et une personne fictive, test@exemple.fr. Ne touche jamais la base en ligne.
import { chargerJeuDeDepart, creerBaseD1, personne, profil } from '@gyro-caserne/socle';
import { eq } from 'drizzle-orm';
import { getPlatformProxy } from 'wrangler';

const centre = process.env.CENTRE || 'exemple';
const dossier = new URL(`../../../centres/${centre}/`, import.meta.url);
const { default: description } = await import(new URL('centre.ts', dossier).href);
const { env, dispose } = await getPlatformProxy<{ BASE: D1Database }>({ configPath: new URL('wrangler.jsonc', dossier).pathname, remoteBindings: false });

try {
	const base = creerBaseD1(env.BASE);
	await chargerJeuDeDepart(base, description);
	const [agent] = await base.select({ id: profil.id }).from(profil).where(eq(profil.nom, 'Agent'));
	await base.insert(personne).values({ email: 'test@exemple.fr', prenom: 'Test', nom: 'Fictif', profilId: agent!.id }).onConflictDoNothing();
	console.log(`Base locale de « ${centre} » prête, avec test@exemple.fr.`);
} finally {
	await dispose();
}

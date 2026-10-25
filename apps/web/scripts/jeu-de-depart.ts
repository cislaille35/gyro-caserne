// Remplit la base du centre (CENTRE, « exemple » par défaut) avec le jeu de départ.
// Par défaut, la base locale de développement, avec en plus une personne fictive, test@exemple.fr.
// Avec --en-ligne, la base en ligne du centre, une seule fois à l'installation, sans personne fictive.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chargerJeuDeDepart, creerBaseD1, personne, profil } from '@gyro-caserne/socle';
import { eq } from 'drizzle-orm';
import { getPlatformProxy } from 'wrangler';

const centre = process.env.CENTRE || 'exemple';
const enLigne = process.argv.includes('--en-ligne');
const dossier = new URL(`../../../centres/${centre}/`, import.meta.url);
const { default: description } = await import(new URL('centre.ts', dossier).href);

// En ligne : copie de la config du centre où la base est marquée « remote », effacée à la fin.
let config = new URL('wrangler.jsonc', dossier);
if (enLigne) {
	const texte = readFileSync(config, 'utf8');
	const copie = texte.replace('"binding": "BASE",', '"binding": "BASE", "remote": true,');
	if (copie === texte) throw new Error('Base BASE introuvable dans wrangler.jsonc');
	config = new URL('wrangler.en-ligne.jsonc', dossier);
	writeFileSync(config, copie);
}

try {
	const { env, dispose } = await getPlatformProxy<{ BASE: D1Database }>({
		configPath: config.pathname,
		persist: { path: new URL('.wrangler/state/v3', dossier).pathname },
		remoteBindings: enLigne
	});
	try {
		const base = creerBaseD1(env.BASE);
		await chargerJeuDeDepart(base, description);
		if (enLigne) {
			console.log(`Base en ligne de « ${centre} » prête.`);
		} else {
			const [agent] = await base.select({ id: profil.id }).from(profil).where(eq(profil.nom, 'Agent'));
			await base.insert(personne).values({ email: 'test@exemple.fr', prenom: 'Test', nom: 'Fictif', profilId: agent!.id }).onConflictDoNothing();
			console.log(`Base locale de « ${centre} » prête, avec test@exemple.fr.`);
		}
	} finally {
		await dispose();
	}
} finally {
	if (enLigne) rmSync(config);
}

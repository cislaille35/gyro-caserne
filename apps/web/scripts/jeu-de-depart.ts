// Remplit la base du centre (CENTRE, « exemple » par défaut) avec le jeu de départ.
// Par défaut, la base locale de développement, avec en plus des personnes fictives (dont test@exemple.fr) et un planning fictif.
// Avec --en-ligne, la base en ligne du centre (CENTRE obligatoire), une seule fois à l'installation, sans personne fictive.
// Avec --en-ligne --avec-fictifs, la préprod (centre exemple seulement) reçoit aussi les personnes fictives.
// Avec --comptes-de-test=<boîte> (centre exemple seulement) : un compte par profil, boîte+rôle, et des publications fictives.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { affectationEquipe, chargerComptesDeTest, chargerJeuDeDepart, chargerMaterielFictif, chargerPlanningFictif, creerBaseD1, creerBasePhotos, equipe, personne, profil } from '@gyro-caserne/socle';
import { eq } from 'drizzle-orm';
import { getPlatformProxy } from 'wrangler';
import { maintenantParis } from '../src/lib/aujourdhui.ts';
import { configEnLigne } from './config-en-ligne.ts';

const enLigne = process.argv.includes('--en-ligne');
if (enLigne && !process.env.CENTRE) {
	console.error('CENTRE à préciser pour la base en ligne, par exemple : CENTRE=laille pnpm --filter @gyro-caserne/web jeu-de-depart --en-ligne');
	process.exit(1);
}
const centre = process.env.CENTRE || 'exemple';
const avecFictifs = !enLigne || process.argv.includes('--avec-fictifs');
if (enLigne && avecFictifs && centre !== 'exemple') {
	console.error('Agents fictifs réservés au centre exemple (préprod), jamais dans la base d’un vrai centre.');
	process.exit(1);
}
const boite = process.argv.find((a) => a.startsWith('--comptes-de-test='))?.slice('--comptes-de-test='.length);
if (boite !== undefined && centre !== 'exemple') {
	console.error('Comptes de test réservés au centre exemple (préprod), jamais dans la base d’un vrai centre.');
	process.exit(1);
}

// Personnes fictives : test@exemple.fr pour se connecter en local, et un agent par équipe.
const FICTIFS = [
	{ email: 'test@exemple.fr', prenom: 'Test', nom: 'Fictif', equipe: null },
	{ email: 'alice.martin@exemple.fr', prenom: 'Alice', nom: 'Martin', equipe: 'Équipe 1' },
	{ email: 'bruno.petit@exemple.fr', prenom: 'Bruno', nom: 'Petit', equipe: 'Équipe 2' },
	{ email: 'chloe.durand@exemple.fr', prenom: 'Chloé', nom: 'Durand', equipe: 'Équipe 3' },
	{ email: 'david.leroy@exemple.fr', prenom: 'David', nom: 'Leroy', equipe: 'Équipe 1' }
];
const dossier = new URL(`../../../centres/${centre}/`, import.meta.url);
const { default: description } = await import(new URL('centre.ts', dossier).href);

// En ligne : copie de la config du centre où les deux bases (principale et photos) sont marquées « remote », effacée à la fin.
let config = new URL('wrangler.jsonc', dossier);
if (enLigne) {
	const copie = configEnLigne(readFileSync(config, 'utf8'));
	config = new URL('wrangler.en-ligne.jsonc', dossier);
	writeFileSync(config, copie);
}

try {
	const { env, dispose } = await getPlatformProxy<{ BASE: D1Database; PHOTOS: D1Database }>({
		configPath: config.pathname,
		persist: { path: new URL('.wrangler/state/v3', dossier).pathname },
		remoteBindings: enLigne
	});
	try {
		const base = creerBaseD1(env.BASE);
		await chargerJeuDeDepart(base, description);
		if (avecFictifs) {
			const [agent] = await base.select({ id: profil.id }).from(profil).where(eq(profil.nom, 'Agent'));
			const equipes = await base.select({ id: equipe.id, nom: equipe.nom }).from(equipe);
			for (const f of FICTIFS) {
				const [nouvelle] = await base
					.insert(personne)
					.values({ email: f.email, prenom: f.prenom, nom: f.nom, profilId: agent!.id })
					.onConflictDoNothing()
					.returning({ id: personne.id });
				const sonEquipe = equipes.find((e) => e.nom === f.equipe);
				if (nouvelle && sonEquipe) await base.insert(affectationEquipe).values({ personneId: nouvelle.id, equipeId: sonEquipe.id, debut: '2026-01-01' });
			}
			await chargerMaterielFictif(base, maintenantParis());
			// Un planning fictif : l'année en cours et la suivante publiées, quelques manœuvres.
			await chargerPlanningFictif(base, description, maintenantParis());
		}
		// SUPER_ADMINS, si elle est donnée : aucune de ces adresses ne reçoit de fiche.
		if (boite !== undefined) await chargerComptesDeTest(base, creerBasePhotos(env.PHOTOS), boite, maintenantParis(), (process.env.SUPER_ADMINS ?? '').split(','));
		const lieu = enLigne ? 'en ligne' : 'locale';
		console.log(`Base ${lieu} de « ${centre} » prête${avecFictifs ? ', avec les personnes fictives (dont test@exemple.fr)' : ''}${boite !== undefined ? ', avec les comptes de test' : ''}.`);
	} finally {
		await dispose();
	}
} finally {
	if (enLigne) rmSync(config);
}

import { aNePasManquer, anniversairesDuJour, apercusDesMurs, mursDe, type ApercuMur, type Mur } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { exigerActeur } from '#lib/server/formulaire-mur.ts';
import type { LayoutServerLoad } from './$types';

export type TuileMur = ApercuMur & Pick<Mur, 'nom' | 'type' | 'lectureSeule'> & { nouveautes: number; aConfirmer: number };

// La liste des murs rangée en sections, avec ce qui se passe aujourd'hui au centre et ce qui vient.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Lire l'adresse fait relancer ce chargement à chaque navigation : la pastille d'un mur qu'on vient de quitter disparaît.
	void url.pathname;
	const acteur = exigerActeur(locals);
	const aujourdhui = aujourdhuiParis();
	const [murs, apercus, { annonces, evenements, nouveautes }, anniversaires] = await Promise.all([
		mursDe(locals.base, acteur, aujourdhui),
		apercusDesMurs(locals.base, acteur, aujourdhui),
		aNePasManquer(locals.base, acteur, aujourdhui, maintenantParis()),
		anniversairesDuJour(locals.base, aujourdhui)
	]);

	const tuiles: TuileMur[] = murs.map((m) => ({
		...apercus.find((a) => a.cle === m.cle)!,
		nom: m.nom,
		type: m.type,
		lectureSeule: m.lectureSeule,
		nouveautes: nouveautes.find((n) => n.cle === m.cle)?.nombre ?? 0,
		aConfirmer: annonces.filter((a) => a.cle === m.cle).length
	}));
	const miens = tuiles.filter((t) => t.membre && t.type !== 'centre');
	const comites = miens.filter((t) => t.type === 'comite');
	const calmes = comites.filter((t) => t.nouveautes === 0);
	const replies = calmes.length > 2 ? calmes : [];
	const evenement = evenements.find((e) => e.reponse === null);

	return {
		sections: {
			centre: tuiles.find((t) => t.type === 'centre') ?? null,
			// Mon équipe, puis Vie du centre, puis mes comités, ceux qui ont du neuf d'abord.
			groupes: [
				...miens.filter((t) => t.type === 'equipe'),
				...miens.filter((t) => t.type === 'vie'),
				...comites.filter((t) => t.nouveautes > 0),
				...calmes.filter((t) => !replies.includes(t))
			],
			autres: replies,
			// Le super administrateur n'est membre d'aucun mur : Vie du centre vient ici pour lui.
			supervision: tuiles.filter((t) => !t.membre && t.type !== 'centre')
		},
		aujourdhui: {
			anniversaires,
			evenement: evenement ? { id: evenement.id, cle: evenement.cle, titre: evenement.titre, debut: evenement.debut } : null
		},
		// Les 3 prochains événements où la personne est convoquée, pour la colonne de droite d'un mur.
		aVenir: evenements.slice(0, 3).map((e) => ({ id: e.id, cle: e.cle, nomMur: e.nomMur, titre: e.titre, debut: e.debut }))
	};
};

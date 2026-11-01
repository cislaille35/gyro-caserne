import type { EtatDemande, VueDemande } from '@gyro-caserne/socle';

// Les états, toujours écrits (jamais la couleur seule).
export const ETATS: Record<EtatDemande, { libelle: string; ton: 'ok' | 'info' | 'alerte' | 'danger' | 'neutre' }> = {
	attente: { libelle: 'En attente', ton: 'info' },
	a_valider: { libelle: 'À valider', ton: 'alerte' },
	conclue: { libelle: 'Conclu', ton: 'ok' },
	refusee: { libelle: 'Refusée', ton: 'danger' },
	annulee: { libelle: 'Annulée', ton: 'neutre' },
	expiree: { libelle: 'Expirée', ton: 'neutre' }
};

export const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);
const nom = (q: { prenom: string; nom: string } | null) => (q ? `${q.prenom} ${q.nom}`.trim() : '');

// Le titre d'une demande, vu par l'agent.
export function titreDemande(v: VueDemande): string {
	if (v.genre === 'manoeuvre') return v.moi === 'demandeur' ? `Échange de manœuvre avec ${nom(v.cible)}` : `${nom(v.demandeur)} propose d’échanger une manœuvre`;
	if (v.genre === 'echange') return v.moi === 'demandeur' ? `Échange avec ${nom(v.cible)}` : `${nom(v.demandeur)} propose un échange`;
	if (v.moi === 'demandeur') return v.remplacant ? `Remplacé par ${nom(v.remplacant)}` : v.cible ? `Demandé à ${nom(v.cible)}` : 'Ouverte à tous les disponibles';
	if (v.moi === 'remplacant') return `Je remplace ${nom(v.demandeur)}`;
	return v.remplacant ? `${nom(v.remplacant)} remplace ${nom(v.demandeur)}` : `${nom(v.demandeur)} cherche un remplaçant`;
}

// Ce qui reste à faire, dit en clair.
export function suite(v: VueDemande): string | null {
	if (v.etat === 'a_valider') return `Le chef d’équipe doit valider : il manque ${v.manque.join(', ')} au remplaçant.`;
	if (v.etat === 'refusee' && v.moi === 'demandeur') return v.gestes.ouvrir ? 'Refusée : vous pouvez l’ouvrir à tous les disponibles.' : 'Refusée.';
	if (v.etat === 'expiree') return 'Personne n’a été trouvé à temps : le titulaire reste responsable.';
	return null;
}

// Les tranches libres qui se suivent (un week-end, un férié) : à cocher d'un geste, à partir de deux.
export function blocs<T extends { debut: string; fin: string; prise: boolean }>(tranches: T[]): { debut: string; fin: string }[] {
	const groupes: T[][] = [];
	for (const t of tranches.filter((x) => !x.prise)) {
		const dernier = groupes.at(-1);
		if (dernier && dernier.at(-1)!.fin === t.debut) dernier.push(t);
		else groupes.push([t]);
	}
	return groupes.filter((g) => g.length > 1).map((g) => ({ debut: g[0]!.debut, fin: g.at(-1)!.fin }));
}

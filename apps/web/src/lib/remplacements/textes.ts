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

export type Pas = { libelle: string; etat: 'fait' | 'en-cours' | 'a-venir' | 'arret' };

// La frise d'une demande : Envoyée → Acceptée par X → Validée par le chef (si une aptitude manque) → Conclue ;
// ou elle s'arrête : Refusée, Annulée, Expirée.
export function frise(v: VueDemande): Pas[] {
	const qui = v.remplacant ?? v.cible;
	const pas: Pas[] = [{ libelle: v.genre === 'remplacement' ? 'Envoyée' : 'Proposée', etat: 'fait' }];
	const acceptee = v.remplacant !== null && !['attente', 'refusee'].includes(v.etat);
	if (v.etat === 'refusee') return [...pas, { libelle: qui ? `Refusée par ${nom(qui)}` : 'Refusée', etat: 'arret' }];
	pas.push(acceptee ? { libelle: `Acceptée par ${nom(v.remplacant)}`, etat: 'fait' } : { libelle: qui && v.cible ? `En attente de ${nom(qui)}` : 'En attente d’un collègue', etat: v.etat === 'attente' ? 'en-cours' : 'a-venir' });
	if (v.etat === 'annulee' || v.etat === 'expiree') return [...pas.filter((p) => p.etat === 'fait'), { libelle: v.etat === 'annulee' ? 'Annulée' : 'Expirée', etat: 'arret' }];
	if (v.etat === 'a_valider' || v.manque.length > 0) pas.push({ libelle: v.etat === 'a_valider' ? 'À valider par le chef' : 'Validée par le chef', etat: v.etat === 'a_valider' ? 'en-cours' : v.etat === 'conclue' ? 'fait' : 'a-venir' });
	pas.push({ libelle: 'Conclue', etat: v.etat === 'conclue' ? 'fait' : 'a-venir' });
	return pas;
}

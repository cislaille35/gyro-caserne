import type { Base } from '../base.ts';
import { ete } from '../schema.ts';

// En été, les équipes s'affichent « Groupe A, B, C, D » : dans l'ordre du roulement du centre, équipes actives seulement.
// Le chef les voit dès la proposition (tableau de l'été, onglet du fichier) ; les agents, à la publication. Voir docs/decisions/0021.

export type EteLu = { debut: string; fin: string; publieeLe: string | null };

export const nomsDeGroupes = (equipes: { id: number; active: number }[]) => new Map(equipes.filter((e) => e.active === 1).map((e, i) => [e.id, `Groupe ${String.fromCharCode(65 + i)}`]));

// Les étés. `fin` : le jour de la dernière relève.
export const requeteEtes = (base: Base) => base.select({ debut: ete.debut, fin: ete.fin, publieeLe: ete.publieeLe }).from(ete);

// Ce que voient les agents : seulement un été publié.
export const semaineEnGroupes = (etes: EteLu[], debut: string) => etes.some((e) => e.publieeLe !== null && e.debut <= debut && debut <= e.fin);

// Le nom de groupe de la semaine ; null hors été publié, ou pour une équipe archivée.
export const groupeDeLaSemaine = (etes: EteLu[], noms: Map<number, string>, s: { debut: string; equipeId: number }) => (semaineEnGroupes(etes, s.debut) ? (noms.get(s.equipeId) ?? null) : null);

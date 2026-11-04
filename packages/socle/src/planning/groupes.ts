import { sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ete } from '../schema.ts';

// En été (proposé ou publié), les équipes s'affichent « Groupe A, B, C, D » : dans l'ordre du roulement du centre, équipes actives seulement.
// L'équipe de base reste en interne pour construire la proposition. Voir docs/decisions/0021.

export type EteLu = { debut: string; fin: string; publieeLe: string | null; proposee: number };

export const nomsDeGroupes = (equipes: { id: number; active: number }[]) => new Map(equipes.filter((e) => e.active === 1).map((e, i) => [e.id, `Groupe ${String.fromCharCode(65 + i)}`]));

// Les étés et s'ils ont une proposition (au moins une plage). `fin` : le jour de la dernière relève.
export const requeteEtes = (base: Base) => base.select({ debut: ete.debut, fin: ete.fin, publieeLe: ete.publieeLe, proposee: sql<number>`exists (select 1 from plage_ete where plage_ete.annee = ete.annee)` }).from(ete);

export const semaineEnGroupes = (etes: EteLu[], debut: string) => etes.some((e) => (e.publieeLe !== null || e.proposee === 1) && e.debut <= debut && debut <= e.fin);

// Le nom de groupe de la semaine ; null hors été, ou pour une équipe archivée.
export const groupeDeLaSemaine = (etes: EteLu[], noms: Map<number, string>, s: { debut: string; equipeId: number }) => (semaineEnGroupes(etes, s.debut) ? (noms.get(s.equipeId) ?? null) : null);

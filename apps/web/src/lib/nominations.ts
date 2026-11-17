// Chaque rôle que l'acteur peut attribuer, avec ses titulaires (en cours et à venir).
export const avecTitulaires = <R extends { responsabiliteId: number }, T>(roles: R[], titulaires: Map<number, T[]>) =>
	roles.map((r) => ({ ...r, titulaires: titulaires.get(r.responsabiliteId) ?? [] }));

// Une fonction est à pourvoir quand personne ne la tient (une mission vide ne l'est pas) : le même compte sur Caserne et sur Nominations.
export const aPourvoir = (roles: { nature: string; titulaires: readonly unknown[] }[]) => roles.filter((r) => r.nature === 'fonction' && r.titulaires.length === 0).length;

// Chaque rôle que l'acteur peut attribuer, avec ses titulaires (en cours et à venir).
export const avecTitulaires = <R extends { responsabiliteId: number }, T>(roles: R[], titulaires: Map<number, T[]>) =>
	roles.map((r) => ({ ...r, titulaires: titulaires.get(r.responsabiliteId) ?? [] }));

// Un rôle est à pourvoir quand personne ne le tient : le même compte sur Caserne et sur Nominations.
export const aPourvoir = (roles: { titulaires: readonly unknown[] }[]) => roles.filter((r) => r.titulaires.length === 0).length;

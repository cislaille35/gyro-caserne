// Ce que le service worker affiche à la réception d'une notification. `envoi` : le numéro de l'envoi dans la file ;
// `pastille` : le chiffre de la cloche, posé sur l'icône (pastille.ts).
// Un envoi repris après une coupure peut arriver après un plus récent du même fil (même `tag`) : le plus récent reste
// affiché (il faut toujours afficher quelque chose à la réception ; le remettre à l'identique ne fait pas sonner).
export type Recue = { titre?: string; texte?: string; url?: string; tag?: string; envoi?: number; pastille?: number };
type Affichee = { titre: string; texte: string; data: unknown };

export function aAfficher(recue: Recue, affichees: Affichee[]): { titre: string; texte: string; url: string; envoi?: number } {
	const numero = (data: unknown) => (data as { envoi?: number } | null)?.envoi ?? 0;
	const recente = affichees.find((a) => numero(a.data) > (recue.envoi ?? 0));
	if (recente) return { titre: recente.titre, texte: recente.texte, url: (recente.data as { url?: string }).url ?? '/', envoi: numero(recente.data) };
	return { titre: recue.titre || 'Gyro Caserne', texte: recue.texte ?? '', url: recue.url ?? '/', envoi: recue.envoi };
}

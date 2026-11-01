import type { AvisRemplacement } from '../listes.ts';

// Le titre de chaque avis, dans la cloche et au téléphone.
export const TITRES_AVIS: Record<AvisRemplacement, string> = {
	recue: 'Demande de remplacement',
	acceptee: 'Remplacement accepté',
	refusee: 'Remplacement refusé',
	a_valider: 'Remplacement à valider',
	validee: 'Remplacement validé',
	refus_chef: 'Remplacement refusé par le chef',
	desistement: 'Désistement',
	expiree: 'Demande expirée',
	annulee: 'Remplacement annulé',
	relance: 'Toujours sans remplaçant',
	informe: 'Remplacement conclu'
};

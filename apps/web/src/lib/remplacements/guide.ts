import { reunir, texteTranche, type EtatTranche } from '@gyro-caserne/socle';
import { heure } from '../murs/quand.ts';
import { jourLong } from '../planning/dates.ts';

// Le parcours guidé « Me faire remplacer » / « Échanger », sans affichage : jours de la bande, raccourcis, phrase récapitulative.

export type Periode = { debut: string; fin: string };
export type Tranche = Periode & { etat: EtatTranche };
export type Mode = 'remplacement' | 'echange';
export type Etape = 'quand' | 'qui' | 'avec' | 'sienne' | 'verifier';

export const cle = (p: Periode) => `${p.debut}|${p.fin}`;

// Pourquoi une période ne se choisit pas, toujours écrit.
export const RAISONS: Record<Exclude<EtatTranche, 'libre'>, string> = { passee: 'Passée', prise: 'Déjà demandée', occupe: 'Vous n’êtes pas libre' };

export function etapes(mode: Mode): { id: Etape; titre: string }[] {
	return mode === 'echange'
		? [
				{ id: 'quand', titre: 'Ma période' },
				{ id: 'avec', titre: 'Le collègue' },
				{ id: 'sienne', titre: 'Sa période' },
				{ id: 'verifier', titre: 'Vérifier et envoyer' }
			]
		: [
				{ id: 'quand', titre: 'Quand ?' },
				{ id: 'qui', titre: 'À qui ?' },
				{ id: 'verifier', titre: 'Vérifier et envoyer' }
			];
}

const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Les périodes « début|fin » de l'adresse ou du formulaire, sans doublon.
export function lirePeriodes(valeurs: string[]): Periode[] {
	const lues = valeurs.map((v) => v.split('|')).filter(([d, f]) => d && f && MOMENT.test(d) && MOMENT.test(f));
	return [...new Map(lues.map(([debut, fin]) => [`${debut}|${fin}`, { debut: debut!, fin: fin! }])).values()];
}

const heures = (p: Periode) => (Date.parse(`${p.fin}:00Z`) - Date.parse(`${p.debut}:00Z`)) / 3_600_000;

// « 18 h – 6 h », « 24 h ».
export const plage = (p: Periode) => (heures(p) === 24 ? '24 h' : `${heure(p.debut)} – ${heure(p.fin)}`);

const plusJours = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Les raccourcis, sur les seules périodes libres ; un raccourci qui répète le précédent, ou une seule période, ne sert à rien.
// Le week-end : le vendredi, le samedi et le dimanche du début de la semaine (pas le vendredi de la relève suivante).
export function raccourcis(tranches: Tranche[], maintenant: string): { libelle: string; periodes: Periode[] }[] {
	const libres = tranches.filter((t) => t.etat === 'libre').map(({ debut, fin }) => ({ debut, fin }));
	const lundi = tranches[0] ? plusJours(tranches[0].debut.slice(0, 10), 3) : '';
	const liste = [
		{ libelle: 'Ce soir', periodes: libres.filter((t) => t.debut.slice(0, 10) === maintenant.slice(0, 10) && t.debut.slice(11, 16) >= '17:00') },
		{ libelle: 'Le week-end', periodes: libres.filter((t) => t.debut.slice(0, 10) < lundi) },
		{ libelle: 'Toute la semaine', periodes: libres.length > 1 ? libres : [] }
	];
	return liste.filter((r, i) => r.periodes.length > 0 && !(r.libelle !== 'Ce soir' && libres.length === 1) && !liste.slice(0, i).some((x) => x.periodes.map(cle).join() === r.periodes.map(cle).join()));
}

// « la nuit du lundi 9 novembre (18 h – 6 h) », « la garde de 24 h du samedi 7 novembre », « du samedi 7 novembre, 6 h au lundi 9 novembre, 6 h »,
// « le vendredi 25 décembre, de 6 h à 18 h » (relève un jour férié).
export function phrasePeriodes(periodes: Periode[]): string {
	const textes = reunir(periodes.map(({ debut, fin }) => ({ debut, fin }))).map((p) => {
		const texte = texteTranche(p);
		if (p.debut.slice(0, 10) === p.fin.slice(0, 10)) return `le ${jourLong(p.debut)}, de ${heure(p.debut)} à ${heure(p.fin)}`;
		if (texte.startsWith('nuit')) return `la ${texte} (${plage(p)})`;
		if (texte.startsWith('24 h')) return `la garde de ${texte}`;
		return texte;
	});
	return textes.length <= 1 ? (textes[0] ?? '') : `${textes.slice(0, -1).join(', ')} et ${textes.at(-1)}`;
}

<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';

	let { data } = $props();

	type Lien = { href: string; titre: string; texte?: string; valeur?: string };
	const organisation: Lien[] = $derived([
		{ href: '/agents', titre: 'Agents', valeur: data.agents === undefined ? undefined : pluriel(data.agents, 'agent') },
		...(data.comites ? [{ href: '/comites', titre: 'Comités et référents', texte: 'Qui fait quoi au centre' }] : []),
		...(data.peutNominations
			? [{ href: '/nominations', titre: 'Nominations', texte: 'Qui tient quel rôle', valeur: data.aPourvoir ? `${data.aPourvoir} à pourvoir` : undefined }]
			: []),
		...(data.peutReglages ? [{ href: '/reglages', titre: 'Réglages', texte: 'Créer les comités et les rôles, régler leurs droits' }] : [])
	]);
	const materiel: Lien[] = $derived([
		...(data.engins === null ? [] : [{ href: '/engins', titre: 'Engins', texte: 'Leur état et leur fiche de prise de garde', valeur: data.engins === undefined ? undefined : pluriel(data.engins, 'engin') }]),
		...(data.anomalies === null || data.anomalies === undefined ? [] : [{ href: '/engins/anomalies', titre: 'Anomalies', texte: 'Ce qui est signalé sur les engins, jusqu’à la réparation', valeur: data.anomalies ? pluriel(data.anomalies, 'ouverte', 'ouvertes') : 'Aucune ouverte' }]),
		{ href: '/reservations', titre: 'Réservations', texte: 'La VL et le matériel de l’amicale' },
		// Comme « Comités et référents » : pour les agents du centre, pas pour le compte de la réserve citoyenne.
		...(data.comites ? [{ href: '/habillement', titre: 'Habillement', texte: 'Demander une tenue, suivre ses demandes' }] : [])
	]);
</script>

<svelte:head>
	<title>Caserne · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Caserne" />
	<div class="colonnes">
		{#each [{ titre: 'Organisation', liens: organisation }, { titre: 'Matériel', liens: materiel }] as g (g.titre)}
			<ListeRangees titre={g.titre}>
				{#each g.liens as l (l.href)}
					<li><Rangee href={l.href} titre={l.titre} sous={l.texte} valeur={l.valeur} /></li>
				{/each}
			</ListeRangees>
		{/each}
	</div>
</div>

<style>
	.page,
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-24);
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
			gap: var(--espace-32);
		}
	}
</style>

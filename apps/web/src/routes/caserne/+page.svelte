<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';

	let { data } = $props();

	const liens: { href: string; titre: string; texte: string; valeur?: string }[] = $derived([
		{ href: '/agents', titre: 'Agents', texte: 'L’équipe et les fiches des agents', valeur: data.agents === undefined ? undefined : pluriel(data.agents, 'agent') },
		...(data.engins === null ? [] : [{ href: '/engins', titre: 'Engins', texte: 'Leur état et leur fiche de prise de garde', valeur: data.engins === undefined ? undefined : pluriel(data.engins, 'engin') }]),
		...(data.anomalies === null || data.anomalies === undefined ? [] : [{ href: '/engins/anomalies', titre: 'Anomalies', texte: 'Ce qui est signalé sur les engins, jusqu’à la réparation', valeur: data.anomalies ? pluriel(data.anomalies, 'ouverte', 'ouvertes') : 'Aucune ouverte' }]),
		{ href: '/reservations', titre: 'Réservations', texte: 'La VL et le matériel de l’amicale' },
		...(data.peutNominations
			? [{ href: '/nominations', titre: 'Nominations', texte: 'Qui tient quel rôle', valeur: data.aPourvoir ? `${data.aPourvoir} à pourvoir` : undefined }]
			: []),
		...(data.peutReglages ? [{ href: '/reglages', titre: 'Réglages', texte: 'Les comités et les responsabilités du centre' }] : [])
	]);
</script>

<svelte:head>
	<title>Caserne · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Caserne" />
	<div class="colonnes">
		<ListeRangees titre="Organisation">
			{#each liens as l (l.href)}
				<li><Rangee href={l.href} titre={l.titre} sous={l.texte} valeur={l.valeur} /></li>
			{/each}
		</ListeRangees>
		<ListeRangees titre="Bientôt">
			<li>
				<Rangee titre="Comités" sous="Les pages des comités arrivent bientôt." discret>
					{#snippet droite()}<Pastille ton="neutre">Bientôt</Pastille>{/snippet}
				</Rangee>
			</li>
		</ListeRangees>
	</div>
</div>

<style>
	.page,
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>

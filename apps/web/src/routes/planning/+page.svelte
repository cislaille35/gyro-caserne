<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import type { IconeRole } from '#lib/ui/icones-roles.ts';

	const CALENDRIER = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4';
	const aVenir: { titre: string; texte: string; icone: IconeRole; dessin?: string }[] = [
		{ titre: 'Astreintes', texte: 'Qui est d’astreinte, jour et nuit, équipe par équipe.', icone: 'casque' },
		{ titre: 'Disponibilités', texte: 'Dire en deux gestes quand vous êtes disponible.', icone: 'camion', dessin: CALENDRIER },
		{ titre: 'Remplacements', texte: 'Demander à être remplacé, et trouver qui peut.', icone: 'groupe' }
	];
</script>

<svelte:head>
	<title>Planning · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Planning" phrase="Les astreintes du centre, bientôt ici." />
	<Vide titre="Le planning arrive bientôt." texte="Astreintes, disponibilités et remplacements : tout se fera ici, depuis le téléphone." />
	<ListeRangees titre="Ce qui arrive">
		{#each aVenir as a (a.titre)}
			<li>
				<Rangee titre={a.titre} sous={a.texte} icone={a.icone} dessin={a.dessin} discret>
					{#snippet droite()}<Pastille ton="neutre">Bientôt</Pastille>{/snippet}
				</Rangee>
			</li>
		{/each}
	</ListeRangees>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 44rem;
	}
</style>

<script lang="ts">
	import GyroDuMoment from '../gyro/GyroDuMoment.svelte';

	let { texte }: { texte: string } = $props();
</script>

<div class="vide">
	<GyroDuMoment tenue="vide" taille={120} decoratif />
	<p>{texte}</p>
</div>

<style>
	.vide {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 1rem;
		text-align: center;
	}
	p {
		margin: 0;
	}
</style>

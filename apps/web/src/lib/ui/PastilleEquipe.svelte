<script lang="ts">
	let { nom, couleur }: { nom: string; couleur: string } = $props();
</script>

<span class="equipe"><span class="pastille" aria-hidden="true" style:background={couleur}></span>{nom}</span>

<style>
	.equipe {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}
	.pastille {
		width: 12px;
		height: 12px;
		border-radius: 6px;
	}
</style>

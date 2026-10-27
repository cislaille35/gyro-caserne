<script lang="ts">
	let { prenom, nom, taille = 40 }: { prenom: string; nom: string; taille?: number } = $props();
	const initiales = $derived(`${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase());
</script>

<span class="initiales" aria-hidden="true" style:width="{taille}px" style:height="{taille}px" style:font-size="{Math.round(taille * 0.4)}px"
	>{initiales}</span
>

<style>
	.initiales {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--statut-neutre-fond);
		color: var(--statut-neutre-texte);
		font-weight: 600;
	}
</style>

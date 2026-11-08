<script lang="ts">
	// Le lien de retour au-dessus d'un titre : « ‹ Agents ».
	let { href, libelle }: { href: string; libelle: string } = $props();
</script>

<a class="retour" {href}
	><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg
	><span class="masque">{'Retour : '}</span>{libelle}</a
>

<style>
	.retour {
		align-self: flex-start;
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin: -6px 0 -4px -6px;
		padding: 0 var(--espace-12) 0 var(--espace-4);
		border-radius: var(--rayon-bouton);
		color: var(--doux);
		font-weight: 600;
		text-decoration: none;
	}
	.retour:hover {
		color: var(--encre);
		background: var(--surface);
	}
</style>

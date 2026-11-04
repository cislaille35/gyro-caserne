<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="erreur" role="alert">
	<span class="signe" aria-hidden="true"
		><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.5 20h19z M12 10v4.5 M12 17.2v.3" /></svg
		></span
	>
	<div>
		<h2>Page indisponible</h2>
		<p>{page.error?.message}</p>
	</div>
</div>

<style>
	.erreur {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 14px;
		background: var(--statut-alerte-fond);
		border: 1px solid var(--statut-alerte-trait);
		border-radius: 18px;
		color: var(--statut-alerte-texte);
	}
	.signe {
		flex: none;
		display: inline-flex;
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		margin-bottom: 4px;
		font: 700 1.25rem/1.2 var(--police-titre);
	}
</style>

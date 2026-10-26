<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="erreur" role="alert">
	<h2>Erreur {page.status}</h2>
	<p>{page.error?.message}</p>
</div>

<style>
	.erreur {
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-grand);
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		margin-bottom: 8px;
	}
</style>

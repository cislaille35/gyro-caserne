<script lang="ts">
	import { enhance } from '$app/forms';
	import { DESSINS } from './icones-roles.ts';

	// Dans l'en-tête d'un mur ou d'une conversation : couper (ou réactiver) ses notifications au téléphone.
	// Un haut-parleur, pas une cloche : la seule cloche de l'écran est celle de l'appli, qui montre toujours tout.
	// Un bouton à bascule (aria-pressed : coupées), dans un formulaire qui marche sans JavaScript.
	let { coupe, nom }: { coupe: boolean; nom: string } = $props();
</script>

<form method="POST" action="?/couper" use:enhance={() => ({ update }) => update({ reset: false, invalidateAll: true })}>
	<input type="hidden" name="oui" value={coupe ? '0' : '1'} />
	<button type="submit" class="couper" class:coupe aria-pressed={coupe ? 'true' : 'false'} title={coupe ? 'Notifications coupées au téléphone' : 'Notifications actives au téléphone'}>
		<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={coupe ? DESSINS.sonCoupe : DESSINS.son} /></svg>
		{#if coupe}<span class="etat">Coupées</span>{/if}
		<span class="masque">{`Couper les notifications de ${nom}`}</span>
	</button>
</form>

<style>
	form {
		display: inline-flex;
	}
	.couper {
		min-width: var(--cible);
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 10px;
		border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface) 70%, transparent);
		color: inherit;
		font: 600 0.9375rem var(--police);
		cursor: pointer;
	}
	.couper:hover {
		border-color: currentColor;
	}
	.coupe {
		background: var(--surface);
		color: var(--encre);
	}
</style>

<script lang="ts">
	import { ICONES_ROLES, type IconeRole } from './icones-roles.ts';

	let { icone, taille = 40 }: { icone: IconeRole; taille?: number } = $props();
</script>

<span
	class="tuile"
	aria-hidden="true"
	style:width="{taille}px"
	style:height="{taille}px"
	style:border-radius="{Math.round(taille * 0.3)}px"
	style:background="var(--icone-{icone}-fond)"
	style:color="var(--icone-{icone}-texte)"
>
	<svg width={Math.round(taille * 0.55)} height={Math.round(taille * 0.55)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
		><path d={ICONES_ROLES[icone]} /></svg
	>
</span>

<style>
	.tuile {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>

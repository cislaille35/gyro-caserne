<script lang="ts">
	import { ICONES_ROLES, type IconeRole } from './icones-roles.ts';

	// `icone` donne le tracé ; `dessin` remplace son tracé, pour une icône hors des rôles (Affichage, Planning…).
	let { icone, taille = 40, dessin }: { icone: IconeRole; taille?: number; dessin?: string } = $props();
</script>

<span
	class="tuile"
	aria-hidden="true"
	style:width="{taille}px"
	style:height="{taille}px"
>
	<svg width={Math.round(taille * 0.55)} height={Math.round(taille * 0.55)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
		><path d={dessin ?? ICONES_ROLES[icone]} /></svg
	>
</span>

<style>
	.tuile {
		flex: none;
		color: var(--encre);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>

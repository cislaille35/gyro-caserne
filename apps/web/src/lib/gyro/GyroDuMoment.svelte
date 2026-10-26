<script lang="ts">
	import Gyro from './Gyro.svelte';
	import { gyroSelonNiveau, lireAffichageContexte } from './niveau.ts';
	import { tenueDuMoment } from './moment.ts';
	import type { Tenue } from './tenues.ts';

	let { taille = 160, tenue, decoratif = false, anime }: { taille?: number; tenue?: Tenue; decoratif?: boolean; anime?: boolean } = $props();

	const affichage = lireAffichageContexte();
	const reglage = $derived(gyroSelonNiveau(affichage.niveau));
</script>

{#if reglage.visible}
	<Gyro tenue={tenue ?? tenueDuMoment(new Date())} {taille} anime={anime ?? reglage.anime} {decoratif} />
{/if}

<script lang="ts">
	import type { ApercuMur } from '@gyro-caserne/socle';
	import { ICONE_MAISON, ICONES_ROLES } from './icones-roles.ts';

	// Le nom du mur est toujours écrit à côté : la pastille est décorative.
	let { icone, couleur, numero, taille = 48 }: Pick<ApercuMur, 'icone' | 'couleur' | 'numero'> & { taille?: 48 | 28 } = $props();

	const trace = $derived(icone === 'maison' ? ICONE_MAISON : icone ? ICONES_ROLES[icone] : null);
	const fond = $derived(icone === 'maison' ? 'var(--rouge)' : icone ? 'transparent' : couleur ? `color-mix(in srgb, ${couleur} 22%, var(--surface))` : 'var(--statut-neutre-fond)');
	const encre = $derived(icone === 'maison' ? 'var(--sur-rouge)' : 'var(--encre)');
</script>

<span
	class="pastille"
	class:petite={taille === 28}
	aria-hidden="true"
	style:width="{taille}px"
	style:height="{taille}px"
	style:background={fond}
	style:color={encre}
	style:--bord={!icone && couleur ? couleur : 'transparent'}
>
	{#if trace}
		<svg width={Math.round(taille * 0.54)} height={Math.round(taille * 0.54)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={trace} /></svg>
	{:else}
		<span>{numero ?? ''}</span>
	{/if}
</span>

<style>
	.pastille {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--rayon-grand);
		box-shadow: inset 0 -4px 0 var(--bord);
		font: 700 var(--texte-20)/1 var(--police-titre);
	}
	.petite {
		border-radius: var(--rayon-petit);
		box-shadow: inset 0 -3px 0 var(--bord);
		font-size: var(--texte-15);
	}
</style>

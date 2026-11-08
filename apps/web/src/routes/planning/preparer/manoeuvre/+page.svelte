<script lang="ts">
	import FormulaireManoeuvre from '#lib/planning/FormulaireManoeuvre.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();

	const m = $derived(data.manoeuvre);
	const retourHref = $derived(`/planning/preparer?annee=${m ? m.debut.slice(0, 4) : data.annee}&etape=manoeuvres`);
</script>

<svelte:head>
	<title>{m ? m.theme : 'Nouvelle manœuvre'} · Planning · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre={m ? 'Modifier la manœuvre' : 'Nouvelle manœuvre'} phrase={m?.publiee ? 'Déjà annoncée : la publication sera mise à jour et les convoqués prévenus.' : 'Elle sera annoncée sur « Le centre » deux semaines avant.'} retour={{ href: retourHref, libelle: 'Préparer l’année' }} />
	<FormulaireManoeuvre manoeuvre={m} equipes={data.equipes} {form} />
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-lecture);
		margin-inline: auto;
	}
</style>

<script lang="ts">
	import Conversation from '#lib/messagerie/Conversation.svelte';
	import InfosCote from '#lib/messagerie/InfosCote.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{data.vue.nom} · Messages · Gyro Caserne</title>
</svelte:head>

<!-- À partir de 1280 px, les infos à droite de la conversation, après elle au clavier. -->
<div class="avec-infos">
	<!-- Une autre conversation, ou une autre page : tout repart de zéro (fil, défilement, rafraîchissement). -->
	{#key `${data.vue.id}:${data.avant}`}
		<Conversation vue={data.vue} moiId={data.moiId} sousTitre={data.sousTitre} avant={data.avant} autrePrenom={data.autrePrenom} prerempli={data.prerempli} coupe={data.coupe} {form} />
	{/key}
	<div class="cote"><InfosCote id={data.vue.id} moiId={data.moiId} infos={data.infos} /></div>
</div>

<style>
	.cote {
		display: none;
	}
	@media (min-width: 1280px) {
		.avec-infos {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 17rem;
		}
		.cote {
			display: block;
			position: sticky;
			top: 0;
			align-self: start;
			/* La colonne va jusqu'en bas, même courte. */
			min-height: calc(100dvh - var(--hauteur-entete));
			max-height: 100dvh;
			overflow-y: auto;
			border-left: 1px solid var(--trait-doux);
			background: var(--surface);
		}
	}
</style>

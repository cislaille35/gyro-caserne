<script lang="ts">
	import Conversation from '#lib/messagerie/Conversation.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{data.vue.nom} · Messages · Gyro Caserne</title>
</svelte:head>

<!-- Une autre conversation, ou une autre page : tout repart de zéro (fil, défilement, rafraîchissement). -->
{#key `${data.vue.id}:${data.avant}`}
	<Conversation vue={data.vue} moiId={data.moiId} sousTitre={data.sousTitre} avant={data.avant} autrePrenom={data.autrePrenom} prerempli={data.prerempli} {form} />
{/key}

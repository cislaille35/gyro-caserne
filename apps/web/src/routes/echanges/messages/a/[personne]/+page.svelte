<script lang="ts">
	import type { VueConversation } from '@gyro-caserne/socle';
	import Conversation from '#lib/messagerie/Conversation.svelte';

	let { data, form } = $props();

	// La conversation n'existe pas encore : un fil vide, avec la personne seule.
	const vue = $derived<VueConversation>({
		id: 0,
		type: 'deux',
		nom: `${data.personne.prenom} ${data.personne.nom}`,
		icone: null,
		membres: [data.personne],
		messages: [],
		premierNonLu: null,
		lectureSeule: false,
		plusAnciens: false,
		majLe: ''
	});
</script>

<svelte:head>
	<title>{vue.nom} · Messages · Gyro Caserne</title>
</svelte:head>

{#key data.personne.id}
	<Conversation {vue} moiId={0} sousTitre={data.sousTitre} nouvelle={{ id: data.personne.id, prenom: data.personne.prenom }} {form} />
{/key}

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { AnniversaireDuJour } from '@gyro-caserne/socle';
	import Bouton from './Bouton.svelte';
	import Pastille from './Pastille.svelte';

	// Le geste sous un anniversaire du jour : « Souhaiter » (un appui, l'agent fêté est prévenu), puis « Souhaité ».
	// Rien pour son propre anniversaire. L'action revient sur la page d'où l'on vient.
	let { a, retour }: { a: AnniversaireDuJour; retour: string } = $props();
	// Un double appui n'envoie qu'un souhait.
	let envoi = $state(false);
</script>

{#if a.geste === 'souhaite'}
	<Pastille ton="ok">Souhaité<span class="masque">{` à ${a.prenom} ${a.nom}`}</span></Pastille>
{:else if a.geste === 'souhaiter'}
	<form method="POST" action="/echanges?/souhaiter" use:enhance={() => {
		envoi = true;
		return async ({ update }) => {
			await update();
			envoi = false;
		};
	}}>
		<input type="hidden" name="id" value={a.id} />
		<input type="hidden" name="retour" value={retour} />
		<Bouton type="submit" variante="secondaire" desactive={envoi}>Souhaiter<span class="masque">{` à ${a.prenom} ${a.nom}`}</span></Bouton>
	</form>
{/if}

<style>
	form {
		flex: none;
	}
</style>

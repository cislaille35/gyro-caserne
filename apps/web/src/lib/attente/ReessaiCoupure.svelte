<script lang="ts">
	import { DELAIS_ATTENTE } from './attente.ts';

	// Un seul essai doux, en GET : si le serveur est encore coupé, le service worker prend le relais avec sa page d'attente.
	$effect(() => {
		const minuteur = setTimeout(() => location.replace(location.href), DELAIS_ATTENTE[0]! * 1000);
		return () => clearTimeout(minuteur);
	});
</script>

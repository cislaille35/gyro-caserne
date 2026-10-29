<script lang="ts">
	import '../app.css';
	import centre from '$centre';
	import { afterNavigate, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { definirAffichage } from '#lib/gyro/niveau.ts';
	import { definirNonLus, lirePastille, suivreNonLus } from '#lib/messagerie/pastille.ts';
	import Coquille from '#lib/ui/Coquille.svelte';

	let { data, children } = $props();

	definirAffichage({
		get niveau() {
			return data.affichage.niveau;
		},
		get theme() {
			return data.affichage.theme;
		}
	});

	// La pastille d'Échanges : reçue avec la page, puis suivie toutes les 30 s. Si elle bouge, la liste des messages est relue.
	let nonLus = $derived(data.nonLus);
	definirNonLus({
		get nombre() {
			return nonLus;
		}
	});
	const recevoir = (n: number) => {
		if (n !== nonLus) void invalidate('messagerie:liste');
		nonLus = n;
	};
	$effect(() => {
		if (data.estPersonne) return suivreNonLus(recevoir);
	});
	// En sortant d'une conversation (lue), la pastille se met à jour sans attendre le prochain tour.
	afterNavigate(({ from }) => {
		if (data.estPersonne && from?.url.pathname.startsWith('/echanges/messages/')) void lirePastille().then((n) => n !== null && recevoir(n));
	});
</script>

<Coquille chemin={page.url.pathname} connecte={data.connecte} cloche={data.cloche} {nonLus} nomCentre={centre.nom}>
	{@render children()}
</Coquille>

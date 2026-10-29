<script lang="ts">
	import '../app.css';
	import centre from '$centre';
	import { afterNavigate, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { definirAffichage } from '#lib/gyro/niveau.ts';
	import { definirNonLus, suivreNonLus } from '#lib/messagerie/pastille.ts';
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
		},
		// Pendant la lecture d'une conversation, le nombre qu'elle recompte à chaque rafraîchissement.
		recu: (n) => suivi?.recu(n)
	});
	let suivi: ReturnType<typeof suivreNonLus> | null = null;
	$effect(() => {
		if (!data.estPersonne) return;
		const s = suivreNonLus(
			untrack(() => nonLus),
			(n) => (nonLus = n),
			() => void invalidate('messagerie:liste')
		);
		suivi = s;
		return () => {
			s.arreter();
			suivi = null;
		};
	});
	afterNavigate(({ from, to }) => suivi?.apresNavigation(from?.url.pathname, to?.url.pathname));
</script>

<Coquille chemin={page.url.pathname} connecte={data.connecte} cloche={data.cloche} {nonLus} nomCentre={centre.nom}>
	{@render children()}
</Coquille>

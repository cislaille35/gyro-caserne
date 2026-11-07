<script lang="ts">
	import '../app.css';
	import centre from '$centre';
	import { afterNavigate, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { definirAffichage } from '#lib/gyro/niveau.ts';
	import { definirNonLus, suivreNonLus } from '#lib/messagerie/pastille.ts';
	import EnvoiCoupe from '#lib/attente/EnvoiCoupe.svelte';
	import Coquille from '#lib/ui/Coquille.svelte';
	import { dansUneConversation, marqueDesLues } from '#lib/ui/navigation.ts';
	import { poserPastille } from '#lib/pastille.ts';
	// Dès le chargement : l'invitation à installer de Chrome et Edge n'arrive qu'une fois, tôt.
	import '#lib/installation.svelte.ts';

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
	// La pastille sur l'icône de l'appli suit la cloche, relue après une lecture (`app:cloche`) ; déconnecté, elle s'efface.
	$effect(() => void poserPastille(navigator, data.connecte ? data.cloche : 0));
	afterNavigate(({ from, to }) => {
		suivi?.apresNavigation(from?.url.pathname, to?.url.pathname);
		// La cloche vient de la racine, que SvelteKit ne recharge pas d'une page à l'autre : relue en arrivant sur une page qui a pu
		// la faire baisser. Au premier chargement aussi (notification push) : la racine a pu compter avant la lecture.
		if (data.cloche > 0 && from?.url.pathname !== to?.url.pathname && marqueDesLues(to?.route.id ?? null)) void invalidate('app:cloche');
	});
</script>

<Coquille chemin={page.url.pathname} connecte={data.connecte} cloche={data.cloche} visage={data.visage} {nonLus} nomCentre={centre.nom} conversation={dansUneConversation(page.route.id, page.error)}>
	{@render children()}
	<EnvoiCoupe />
</Coquille>

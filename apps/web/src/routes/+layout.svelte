<script lang="ts">
	import '../app.css';
	import centre from '$centre';
	import { page } from '$app/state';
	import { definirAffichage } from '#lib/gyro/niveau.ts';
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
</script>

<Coquille chemin={page.url.pathname} connecte={data.connecte} estPersonne={data.estPersonne} peutReglages={data.peutReglages} nomCentre={centre.nom}>
	{@render children()}
</Coquille>

<script lang="ts">
	import '../app.css';
	import centre from '$centre';
	import { page } from '$app/state';
	import Coquille from '#lib/ui/Coquille.svelte';

	let { data, children } = $props();
</script>

<Coquille chemin={page.url.pathname} connecte={data.connecte} nomCentre={centre.nom}>
	{@render children()}
</Coquille>

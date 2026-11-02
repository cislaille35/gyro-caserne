<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import type { IconeRole } from '#lib/ui/icones-roles.ts';

	let { data } = $props();

	const liens: { href: string; titre: string; texte: string; icone: IconeRole; valeur?: string }[] = $derived([
		{ href: '/agents', titre: 'Agents', texte: 'L’équipe et les fiches des agents', icone: 'casque', valeur: data.agents === undefined ? undefined : pluriel(data.agents, 'agent') },
		...(data.engins === null ? [] : [{ href: '/engins', titre: 'Engins', texte: 'Leur état et leur fiche de prise de garde', icone: 'camion' as const, valeur: data.engins === undefined ? undefined : pluriel(data.engins, 'engin') }]),
		{ href: '/reservations', titre: 'Réservations', texte: 'La VL et le matériel de l’amicale', icone: 'cle' as const },
		...(data.peutNominations
			? [{ href: '/nominations', titre: 'Nominations', texte: 'Qui tient quel rôle', icone: 'etoile' as const, valeur: data.aPourvoir ? `${data.aPourvoir} à pourvoir` : undefined }]
			: []),
		...(data.peutReglages ? [{ href: '/reglages', titre: 'Réglages', texte: 'Les comités et les responsabilités du centre', icone: 'outil' as const }] : [])
	]);
</script>

<svelte:head>
	<title>Caserne · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Caserne" phrase="Le centre, ses agents et son organisation." gyro />
	<div class="colonnes">
		<ListeRangees titre="Organisation">
			{#each liens as l (l.href)}
				<li><Rangee href={l.href} titre={l.titre} sous={l.texte} icone={l.icone} valeur={l.valeur} /></li>
			{/each}
		</ListeRangees>
		<ListeRangees titre="Bientôt">
			<li>
				<Rangee titre="Comités" sous="Les pages des comités arrivent bientôt." icone="groupe" discret>
					{#snippet droite()}<Pastille ton="neutre">Bientôt</Pastille>{/snippet}
				</Rangee>
			</li>
		</ListeRangees>
	</div>
</div>

<style>
	.page,
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
			gap: 28px;
		}
	}
</style>

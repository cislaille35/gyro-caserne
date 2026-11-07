<script lang="ts">
	import { formatDeDate } from '@gyro-caserne/socle/dates';
	import { pluriel } from '#lib/pluriel.ts';
	import { page } from '$app/state';
	import { iconeDuComite, iconeDuRole, type Droit } from '@gyro-caserne/socle';
	import { DOMAINES, estPersonnalise, niveauxDe } from '#lib/paquets.ts';
	import Groupe from '#lib/ui/Groupe.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import { titulaires } from './roles.ts';
	import type { LayoutData } from './$types';

	// Les rôles rangés par thème, les comités et les profils : une rangée par élément, un appui ouvre sa page. Les archivés restent repliés.
	let { data, niveauTitre = 2 }: { data: LayoutData; niveauTitre?: 2 | 3 } = $props();

	type Resp = NonNullable<LayoutData['responsabilites']>[number];
	const actifs = $derived((data.responsabilites ?? []).filter((r) => r.archiveeLe === null));
	const commandement = $derived(actifs.filter((r) => r.systeme === 'chef_centre' || r.systeme === 'chef_centre_adjoint'));
	const equipes = $derived(actifs.filter((r) => r.portee === 'equipe'));
	const referents = $derived(actifs.filter((r) => r.portee === 'centre' && r.systeme === null));
	const rolesComite = $derived(actifs.filter((r) => r.portee === 'comite'));
	const comites = $derived((data.comites ?? []).filter((c) => c.dissousLe === null));
	const archives = $derived((data.responsabilites ?? []).filter((r) => r.archiveeLe !== null));
	const dissous = $derived((data.comites ?? []).filter((c) => c.dissousLe !== null));

	function resumeProfil(droits: string[]): string {
		const niveaux = niveauxDe(droits as Droit[]);
		const dits = DOMAINES.filter((d) => niveaux[d.id] !== 0).map((d) => {
			const n = niveaux[d.id];
			return `${d.nom} : ${n === 'sur_mesure' ? 'Sur mesure' : d.niveaux[n]!.libelle}`;
		});
		return dits.join(' · ') || 'Rien de plus que les droits de base';
	}

	let ouvreArchives = $state(false);
	const courant = (href: string) => page.url.pathname === href;
	const dateCourte = (iso: string) => formatDeDate({ timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
</script>

{#snippet role(r: Resp)}
	<li>
		<Rangee href="/reglages/roles/{r.id}" courant={courant(`/reglages/roles/${r.id}`)} icone={iconeDuRole(r)} titre={r.nom} sous={r.titulaires === 0 ? undefined : titulaires(r.titulaires)}>
			{#snippet droite()}
				{#if r.titulaires === 0}<Pastille ton="alerte">À pourvoir</Pastille>{/if}
				{#if estPersonnalise(r.droits.map((d) => d.droit as Droit), r.modele)}<Pastille ton="alerte">Personnalisé</Pastille>{/if}
			{/snippet}
		</Rangee>
	</li>
{/snippet}

{#snippet theme(titre: string, roles: Resp[])}
	{#if roles.length > 0}
		<ListeRangees {titre} compte={roles.length}>
			{#each roles as r (r.id)}{@render role(r)}{/each}
		</ListeRangees>
	{/if}
{/snippet}

<div class="liste">
	{@render theme('Chef de centre et adjoint', commandement)}
	{@render theme('Chefs de garde', equipes)}
	{@render theme('Référents', referents)}

	{#if comites.length > 0 || rolesComite.length > 0}
		<ListeRangees titre="Comités" compte={comites.length + rolesComite.length}>
			{#each comites as c (c.id)}
				<li>
					<Rangee
						href="/reglages/comites/{c.id}"
						courant={courant(`/reglages/comites/${c.id}`)}
						icone={iconeDuComite(c)}
						titre={c.nom}
						sous="{pluriel(c.membresEnCours, 'membre')} · {c.rapporteurs.length > 0 ? `rapporteur : ${c.rapporteurs.join(', ')}` : 'pas de rapporteur'}"
					/>
				</li>
			{/each}
			{#each rolesComite as r (r.id)}{@render role(r)}{/each}
		</ListeRangees>
	{/if}

	{#if data.responsabilites}
		<ListeRangees titre="Listes du centre">
			<li><Rangee href="/reglages/aptitudes" courant={courant('/reglages/aptitudes')} titre="Aptitudes" sous="CA, conduite, spécialités ; celles contrôlées en remplacement" /></li>
			<li><Rangee href="/reglages/armement" courant={courant('/reglages/armement')} titre="Armement des engins" sous="L’équipage de chaque engin ; le FPT guide le planning d’été" /></li>
		</ListeRangees>
	{/if}

	{#if data.profils}
		<ListeRangees titre="Profils" compte={data.profils.length}>
			{#each data.profils as p (p.id)}
				<li><Rangee href="/reglages/profils/{p.id}" courant={courant(`/reglages/profils/${p.id}`)} titre={p.nom} sous={resumeProfil(p.droits)} /></li>
			{/each}
		</ListeRangees>
	{/if}

	{#if archives.length > 0 || dissous.length > 0}
		<Groupe titre="Archivés" resume={pluriel(archives.length + dissous.length, 'élément')} {niveauTitre} bind:ouvert={ouvreArchives}>
			<ul class="archives">
				{#each archives as r (r.id)}
					<li>
						<Rangee href="/reglages/roles/{r.id}" courant={courant(`/reglages/roles/${r.id}`)} icone={iconeDuRole(r)} titre={r.nom} sous="Archivé le {dateCourte(r.archiveeLe!)}" />
					</li>
				{/each}
				{#each dissous as c (c.id)}
					<li class="dissous">{c.nom}, comité dissous le {dateCourte(c.dissousLe!)}</li>
				{/each}
			</ul>
		</Groupe>
	{/if}
</div>

<style>
	.liste {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	/* Dans le bloc replié : des lignes séparées par un trait fin, sans carte de plus. */
	.archives {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.archives > li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.dissous {
		padding: 12px 14px;
		color: var(--doux);
	}
</style>

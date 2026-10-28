<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import type { Droit } from '@gyro-caserne/socle';
	import { DOMAINES, estPersonnalise, niveauxDe } from '#lib/paquets.ts';
	import Groupe from '#lib/ui/Groupe.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import type { IconeRole as Icone } from '#lib/ui/icones-roles.ts';
	import Pastille from '#lib/ui/Pastille.svelte';
	import { iconeDe, titulaires } from './roles.ts';
	import type { LayoutData } from './$types';

	// Les rôles rangés par thème, les comités et les profils : une ligne par élément, un appui ouvre sa page.
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

	const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
	function resumeRoles(roles: Resp[]): string {
		const vides = roles.filter((r) => r.titulaires === 0).length;
		return [pluriel(roles.length, 'rôle'), vides > 0 ? `${vides} sans titulaire` : ''].filter(Boolean).join(' · ');
	}
	function resumeProfil(droits: string[]): string {
		const niveaux = niveauxDe(droits as Droit[]);
		const dits = DOMAINES.filter((d) => niveaux[d.id] !== 0).map((d) => {
			const n = niveaux[d.id];
			return `${d.nom} : ${n === 'sur_mesure' ? 'Sur mesure' : d.niveaux[n]!.libelle}`;
		});
		return dits.join(' · ') || 'Rien de plus que les droits de base';
	}

	let ouverts = $state({ commandement: false, equipes: false, referents: false, comites: false, profils: false, archives: false });
	// Sur ordinateur, la place permet de tout afficher.
	onMount(() => {
		if (matchMedia('(min-width: 1024px)').matches) ouverts = { commandement: true, equipes: true, referents: true, comites: true, profils: true, archives: false };
	});
	const courant = (href: string) => (page.url.pathname === href ? 'page' : undefined);
</script>

{#snippet ligne(href: string, icone: Icone, nom: string, info: Snippet)}
	<li>
		<a {href} aria-current={courant(href)}>
			<IconeRole {icone} />
			<span class="textes">
				<span class="nom">{nom}</span>
				<span class="info">{@render info()}</span>
			</span>
			<span class="chevron" aria-hidden="true">›</span>
		</a>
	</li>
{/snippet}

{#snippet role(r: Resp)}
	{#snippet info()}
		{#if r.titulaires === 0}<Pastille ton="alerte">Aucun titulaire</Pastille>{:else}{titulaires(r.titulaires)}{/if}
		{#if estPersonnalise(r.droits.map((d) => d.droit as Droit), r.modele)}<Pastille ton="info">Personnalisé</Pastille>{/if}
	{/snippet}
	{@render ligne(`/reglages/roles/${r.id}`, iconeDe(r), r.nom, info)}
{/snippet}

{#snippet groupeRoles(cle: 'commandement' | 'equipes' | 'referents', titre: string, roles: Resp[])}
	{#if roles.length > 0}
		<Groupe {titre} resume={resumeRoles(roles)} {niveauTitre} bind:ouvert={ouverts[cle]}>
			<ul>
				{#each roles as r (r.id)}{@render role(r)}{/each}
			</ul>
		</Groupe>
	{/if}
{/snippet}

<div class="liste">
	{#if data.responsabilites || data.comites}
		<div class="nouveaux">
			{#if data.responsabilites}<a class="nouveau" href="/reglages/roles/nouveau">+ Nouveau rôle</a>{/if}
			{#if data.comites}<a class="nouveau secondaire" href="/reglages/comites/nouveau">+ Nouveau comité</a>{/if}
		</div>
	{/if}

	{@render groupeRoles('commandement', 'Chef de centre et adjoint', commandement)}
	{@render groupeRoles('equipes', 'Chefs d’équipe', equipes)}
	{@render groupeRoles('referents', 'Référents', referents)}

	{#if comites.length > 0 || rolesComite.length > 0}
		<Groupe titre="Comités" resume={[comites.length > 0 ? pluriel(comites.length, 'comité') : '', rolesComite.length > 0 ? pluriel(rolesComite.length, 'rôle') : ''].filter(Boolean).join(' · ')} {niveauTitre} bind:ouvert={ouverts.comites}>
			<ul>
				{#each comites as c (c.id)}
					{#snippet info()}
						{pluriel(c.membresEnCours, 'membre')} · {c.rapporteurs.length > 0 ? `rapporteur : ${c.rapporteurs.join(', ')}` : 'pas de rapporteur'}
					{/snippet}
					{@render ligne(`/reglages/comites/${c.id}`, 'groupe', c.nom, info)}
				{/each}
				{#each rolesComite as r (r.id)}{@render role(r)}{/each}
			</ul>
		</Groupe>
	{/if}

	{#if data.profils}
		<Groupe titre="Profils" resume={pluriel(data.profils.length, 'profil')} {niveauTitre} bind:ouvert={ouverts.profils}>
			<ul>
				{#each data.profils as p (p.id)}
					{#snippet info()}{resumeProfil(p.droits)}{/snippet}
					{@render ligne(`/reglages/profils/${p.id}`, 'casque', p.nom, info)}
				{/each}
			</ul>
		</Groupe>
	{/if}

	{#if archives.length > 0 || dissous.length > 0}
		<Groupe titre="Archivés" resume={pluriel(archives.length + dissous.length, 'élément')} {niveauTitre} bind:ouvert={ouverts.archives}>
			<ul>
				{#each archives as r (r.id)}
					{#snippet info()}Archivé le {new Date(`${r.archiveeLe}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}{/snippet}
					{@render ligne(`/reglages/roles/${r.id}`, iconeDe(r), r.nom, info)}
				{/each}
				{#each dissous as c (c.id)}
					<li class="dissous">{c.nom}, comité dissous le {new Date(`${c.dissousLe}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</li>
				{/each}
			</ul>
		</Groupe>
	{/if}
</div>

<style>
	.liste {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.nouveaux {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.nouveau {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		padding: 0 18px;
		border-radius: var(--rayon-petit);
		background: var(--rouge);
		color: var(--sur-rouge);
		border: 2px solid var(--encre);
		font-weight: 700;
		text-decoration: none;
	}
	.nouveau.secondaire {
		background: var(--surface);
		color: var(--encre);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li + li {
		border-top: 1px solid var(--trait-doux);
	}
	a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		padding: 8px 14px;
		color: var(--encre);
		text-decoration: none;
	}
	a[aria-current='page'] {
		background: var(--fond);
		box-shadow: inset 4px 0 0 var(--encre);
	}
	.textes {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.nom {
		font-weight: 600;
	}
	.info {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--doux);
	}
	.chevron {
		font-size: 1.25rem;
		color: var(--doux);
	}
	.dissous {
		padding: 12px 14px;
		color: var(--doux);
	}
</style>

<script lang="ts">
	import type { InfosConversation } from '@gyro-caserne/socle';
	import { ICONES_ROLES } from '#lib/ui/icones-roles.ts';
	import Visage from '#lib/ui/Visage.svelte';
	import { resumeGroupe } from './infos.ts';

	// Les infos d'une conversation, en colonne à droite à l'ordinateur. Les gestes mènent à la page des infos.
	let { id, moiId, infos }: { id: number; moiId: number; infos: InfosConversation } = $props();

	type Membre = InfosConversation['membres'][number];
	type Icone = keyof typeof ICONES_ROLES;
	const groupe = $derived(infos.type === 'groupe');
	const autre = $derived(infos.membres.find((m) => m.id !== moiId) ?? null);
	const icone = $derived<Icone>(infos.icone && infos.icone in ICONES_ROLES ? (infos.icone as Icone) : 'groupe');
	const sous = (m: Membre) => m.role ?? (m.equipe ? `Équipe ${m.equipe.numero}` : '');
	const chiffres = (tel: string) => tel.replace(/[^\d+]/g, '');
	const page = $derived(`/echanges/messages/${id}/infos`);
</script>

{#snippet cadenas()}
	<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
{/snippet}

<aside class="infos" aria-labelledby="t-infos">
	{#if groupe}
		<div class="tete">
			<span class="icone" aria-hidden="true" style:background="var(--icone-{icone}-fond)" style:color="var(--icone-{icone}-texte)"
				><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={ICONES_ROLES[icone]} /></svg></span
			>
			<h2 id="t-infos">Infos du groupe</h2>
		</div>
		<p class="resume">{resumeGroupe({ membres: infos.membres.length, creePar: infos.creePar, creeParPrenom: infos.creeParPrenom }, moiId)}</p>
		<p class="prive">{@render cadenas()}Seuls les membres lisent ce groupe.</p>
		<div class="gestes">
			<a class="pilule" href="{page}?renommer">Renommer</a>
			{#if infos.moiAnimateur}<a class="pilule" href="/echanges/messages/nouveau/groupe?ajouter={id}"><span aria-hidden="true">+</span> Ajouter des membres</a>{/if}
		</div>
		<ul>
			{#each infos.membres as m (m.id)}
				<li>
					<Visage prenom={m.prenom} nom={m.nom} couleur={m.equipe?.couleur ?? null} taille={30} />
					<span class="textes">
						<span class="nom">{m.id === moiId ? 'Vous' : `${m.prenom} ${m.nom}`}</span>
						{#if sous(m)}<span class="sous">{sous(m)}</span>{/if}
					</span>
					{#if m.animateur}<span class="animateur">Animateur</span>{/if}
				</li>
			{/each}
		</ul>
		<a class="lien" href={page}>Gérer les membres</a>
		<a class="quitter" href="{page}?quitter"
			><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" /></svg>Quitter le groupe</a
		>
	{:else}
		<h2 id="t-infos">Infos</h2>
		{#if autre}
			<div class="personne">
				<Visage prenom={autre.prenom} nom={autre.nom} couleur={autre.equipe?.couleur ?? null} taille={52} />
				<span class="textes">
					<span class="nom">{autre.prenom} {autre.nom}</span>
					{#if sous(autre)}<span class="sous">{sous(autre)}</span>{/if}
				</span>
			</div>
			<p class="prive">{@render cadenas()}Seuls vous deux lisez cette conversation.</p>
			<dl>
				<div><dt>Équipe</dt><dd>{autre.equipe ? `Équipe ${autre.equipe.numero}` : 'Aucune'}</dd></div>
				{#if autre.role}<div><dt>Rôle</dt><dd>{autre.role}</dd></div>{/if}
				{#if autre.telephone}<div><dt>Téléphone</dt><dd><a href="tel:{chiffres(autre.telephone)}">{autre.telephone}</a></dd></div>{/if}
			</dl>
		{/if}
	{/if}
</aside>

<style>
	.infos {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px 16px;
	}
	h2 {
		margin: 0;
		font: 700 1.25rem/1.15 var(--police-titre);
	}
	p {
		margin: 0;
	}
	.tete,
	.personne {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.icone {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.resume,
	.sous {
		color: var(--doux);
		font-size: 0.875rem;
	}
	.prive {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--doux);
		font-size: 0.8125rem;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pilule {
		min-height: var(--cible);
		padding: 0 14px;
		border: 1px solid var(--statut-neutre-trait);
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--encre);
		font-weight: 600;
		font-size: 0.9375rem;
		text-decoration: none;
	}
	.pilule:hover {
		background: var(--fond);
		color: var(--encre);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.textes {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.nom {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.animateur {
		flex: none;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		font-size: 0.75rem;
		font-weight: 700;
	}
	.lien,
	.quitter {
		min-height: var(--cible);
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}
	.lien {
		color: var(--statut-info-texte);
	}
	.quitter {
		margin-top: 4px;
		color: var(--statut-danger-texte);
		text-decoration: none;
	}
	.quitter:hover {
		text-decoration: underline;
		color: var(--statut-danger-texte);
	}
	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	dl div {
		display: flex;
		flex-direction: column;
	}
	dt {
		color: var(--doux);
		font-size: 0.8125rem;
	}
	dd {
		margin: 0;
		font-weight: 600;
	}
	dd a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
	}
</style>

<script lang="ts">
	import type { ApercuConversation } from '@gyro-caserne/socle';
	import { untrack } from 'svelte';
	import { quand } from '#lib/murs/quand.ts';
	import FiltresEchanges from '#lib/ui/FiltresEchanges.svelte';
	import { ICONES_ROLES } from '#lib/ui/icones-roles.ts';
	import Vide from '#lib/ui/Vide.svelte';
	import Visage from '#lib/ui/Visage.svelte';

	let { data } = $props();

	// La recherche part de celle reçue sans JavaScript, puis filtre à chaque frappe.
	let recherche = $state(untrack(() => data.q));
	const plat = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
	const visibles = $derived(data.conversations.filter((c) => plat(c.nom).includes(plat(recherche))));
	const total = $derived(data.conversations.reduce((n, c) => n + c.nonLus, 0));

	const nonLusEnTexte = (n: number) => `${n} ${n > 1 ? 'messages non lus' : 'message non lu'}`;
	// Un groupe : son icône sur sa teinte (« groupe » par défaut).
	// À deux, l'aperçu ne répète pas le prénom de l'autre : son nom est juste au-dessus.
	const apercu = (c: ApercuConversation) => (c.personne && c.apercu.startsWith(`${c.personne.prenom} : `) ? c.apercu.slice(c.personne.prenom.length + 3) : c.apercu);
	type Icone = keyof typeof ICONES_ROLES;
	const icone = (c: ApercuConversation): Icone => (c.icone && c.icone in ICONES_ROLES ? (c.icone as Icone) : 'groupe');
</script>

<svelte:head>
	<title>Messages · Gyro Caserne</title>
</svelte:head>

<div class="messages">
	<header class="entete">
		<h1>Échanges</h1>
		<a class="crayon" href="/echanges/messages/nouveau" aria-label="Nouveau message">
			<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg
			>
		</a>
	</header>

	<FiltresEchanges actif="messages" nonLus={total} />

	{#if data.conversations.length === 0}
		<Vide texte="Aucune conversation. Écrivez à un collègue avec le crayon." />
	{:else}
		<form class="recherche" method="get" role="search" onsubmit={(e) => e.preventDefault()}>
			<label for="recherche" class="masque">Rechercher une conversation</label>
			<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
				><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg
			>
			<input id="recherche" type="search" name="q" bind:value={recherche} placeholder="Rechercher une conversation" autocomplete="off" />
		</form>

		<!-- Toujours présent, pour que le lecteur d'écran annonce une recherche sans résultat. -->
		<p class="aucune" role="status">{visibles.length === 0 ? 'Aucune conversation à ce nom.' : ''}</p>
		{#if visibles.length > 0}
			<ul>
				{#each visibles as c (c.id)}
					<li>
						<a class="conversation" class:non-lue={c.nonLus > 0} href="/echanges/messages/{c.id}">
							{#if c.type === 'deux'}
								{@const [prenom = '', ...nom] = c.nom.split(' ')}
								<Visage prenom={c.personne?.prenom ?? prenom} nom={c.personne?.nom ?? nom.join(' ')} couleur={c.personne?.couleur ?? null} taille={52} />
							{:else}
								<span class="groupe" aria-hidden="true" style:background="var(--icone-{icone(c)}-fond)" style:color="var(--icone-{icone(c)}-texte)">
									<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={ICONES_ROLES[icone(c)]} /></svg>
								</span>
							{/if}
							<span class="corps">
								<span class="ligne">
									<strong class="nom">{c.nom}</strong>
									<time class="heure" datetime={c.dernier_le}>{quand(c.dernier_le)}</time>
								</span>
								<span class="ligne">
									<span class="apercu">{apercu(c)}</span>
									{#if c.nonLus > 0}
										<span class="nombre"><span aria-hidden="true">{c.nonLus > 99 ? '99+' : c.nonLus}</span><span class="masque">{nonLusEnTexte(c.nonLus)}</span></span>
									{/if}
								</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="confidentialite">Seuls les membres d’une conversation la lisent.</p>
	{/if}
</div>

<style>
	.messages {
		max-width: 44rem;
		display: flex;
		flex-direction: column;
		gap: 12px;
		/* Le bouton crayon flotte au-dessus de la barre du bas : la fin de liste passe toujours au-dessus de lui. */
		padding-bottom: 5rem;
	}
	.entete {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h1 {
		flex: 1;
		margin: 0;
		font: 700 1.875rem/1.1 var(--police-titre);
	}

	.crayon {
		position: fixed;
		right: 16px;
		bottom: calc(4.5rem + env(safe-area-inset-bottom));
		z-index: 10;
		width: 60px;
		height: 60px;
		border-radius: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		box-shadow: 0 6px 16px color-mix(in srgb, var(--rouge) 35%, transparent);
	}
	.crayon:hover {
		background: color-mix(in srgb, var(--rouge) 88%, black);
		color: var(--sur-rouge);
	}

	.recherche {
		position: relative;
		display: flex;
	}
	.recherche svg {
		position: absolute;
		left: 14px;
		top: 13px;
		color: var(--doux);
	}
	input {
		flex: 1;
		min-height: var(--cible);
		padding: 0 16px 0 40px;
		border: 1px solid var(--trait);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	input::placeholder {
		color: var(--doux);
	}

	ul {
		list-style: none;
		margin: 0 -8px;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.conversation {
		min-height: 72px;
		padding: 8px;
		border-radius: var(--rayon-grand);
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--encre);
		text-decoration: none;
	}
	.conversation:hover {
		background: var(--surface);
		color: var(--encre);
	}
	.groupe {
		flex: none;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.corps {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ligne {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.nom,
	.apercu {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.nom {
		font-size: 1.0625rem;
		font-weight: 600;
	}
	.heure {
		flex: none;
		color: var(--doux);
		font-size: 0.8125rem;
	}
	.apercu {
		color: var(--doux);
		font-size: 0.9375rem;
	}
	/* Non lus : le nombre est écrit dans la pastille et dit en texte ; la couleur et le gras ne font que souligner. */
	.non-lue .nom {
		font-weight: 700;
	}
	.non-lue .heure {
		color: var(--accent);
		font-weight: 700;
	}
	.non-lue .apercu {
		color: var(--encre);
		font-weight: 600;
	}
	.nombre {
		flex: none;
		min-width: 22px;
		height: 22px;
		padding: 0 7px;
		border-radius: 11px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.aucune:empty {
		display: contents;
	}
	.aucune,
	.confidentialite {
		margin: 8px 16px 0;
		color: var(--doux);
		font-size: 0.875rem;
		text-align: center;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	/* À l'ordinateur : le crayon prend place à côté du titre, rien ne flotte. */
	@media (min-width: 1024px) {
		.messages {
			padding-bottom: 0;
		}
		.crayon {
			position: static;
			width: 48px;
			height: 48px;
			border-radius: 16px;
		}
	}
</style>

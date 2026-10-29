<script lang="ts">
	import type { InfosConversation } from '@gyro-caserne/socle';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import MenuGestes from '#lib/messagerie/MenuGestes.svelte';
	import { gestesMembre, resumeGroupe, type GesteMembre } from '#lib/messagerie/infos.ts';
	import Champ from '#lib/ui/Champ.svelte';
	import { ICONES_ROLES } from '#lib/ui/icones-roles.ts';
	import Visage from '#lib/ui/Visage.svelte';
	import type { ReponseInfos } from './+page.server';

	let { data, form }: { data: { id: number; moiId: number; infos: InfosConversation; mode: 'renommer' | 'quitter' | null; fiche: string | null }; form: ReponseInfos | null } = $props();

	type Membre = InfosConversation['membres'][number];
	type Icone = keyof typeof ICONES_ROLES;

	const infos = $derived(data.infos);
	const groupe = $derived(infos.type === 'groupe');
	const autre = $derived(infos.membres.find((m) => m.id !== data.moiId) ?? null);
	const icone = $derived<Icone>(infos.icone && infos.icone in ICONES_ROLES ? (infos.icone as Icone) : 'groupe');
	const nomComplet = (m: Membre) => `${m.prenom} ${m.nom}`;
	const sous = (m: Membre) => m.role ?? (m.equipe ? `Équipe ${m.equipe.numero}` : '');
	const pluriel = (n: number) => `${n} membre${n > 1 ? 's' : ''}`;
	const chiffres = (tel: string) => tel.replace(/[^\d+]/g, '');
	const retourInfos = $derived(`/echanges/messages/${data.id}/infos`);
	const erreur = $derived(form?.message && form.cible !== 'renommer' ? form.message : '');

	let js = $state(false);
	onMount(() => (js = true));

	// Les succès sont dits par la zone d'état ; ils s'effacent seuls.
	let annonce = $state('');
	let minuteur: ReturnType<typeof setTimeout> | undefined;
	function dire(phrase: string) {
		annonce = phrase;
		clearTimeout(minuteur);
		minuteur = setTimeout(() => (annonce = ''), 5000);
	}

	// Renommer : le champ prend le focus en arrivant.
	let tete = $state<HTMLElement>();
	$effect(() => {
		if (data.mode === 'renommer') void tick().then(() => tete?.querySelector<HTMLInputElement>('input[name="nom"]')?.focus());
	});

	// Le menu d'un membre.
	let menuOuvert = $state<number | null>(null);
	const bouton = (m: number) => document.getElementById(`actions-${m}`);
	function fermer(rendreFocus: boolean) {
		const m = menuOuvert;
		menuOuvert = null;
		if (rendreFocus && m !== null) bouton(m)?.focus();
	}
	$effect(() => {
		if (menuOuvert === null) return;
		const ouvert = menuOuvert;
		const dehors = (e: PointerEvent) => {
			const cible = e.target as Node;
			if (!document.getElementById(`menu-${ouvert}`)?.contains(cible) && !bouton(ouvert)?.contains(cible)) fermer(false);
		};
		document.addEventListener('pointerdown', dehors, true);
		return () => document.removeEventListener('pointerdown', dehors, true);
	});

	// Nommer, retirer et quitter demandent une confirmation.
	type Confirmation = { geste: 'nommer' | 'retirer'; m: Membre } | { geste: 'quitter' };
	let confirmation = $state<Confirmation | null>(null);
	let dialogue = $state<HTMLDialogElement>();
	$effect(() => {
		if (confirmation && dialogue && !dialogue.open) dialogue.showModal();
	});
	function fermerConfirmation() {
		const c = confirmation;
		dialogue?.close();
		confirmation = null;
		if (c && c.geste !== 'quitter') bouton(c.m.id)?.focus();
		else document.getElementById('quitter')?.focus();
	}

	function choisir(m: Membre, geste: GesteMembre['cle']) {
		fermer(geste === 'ecrire');
		if (geste === 'ecrire') void goto(`/echanges/messages/a/${m.id}`);
		else confirmation = { geste, m };
	}
	function quitter(e: MouseEvent) {
		e.preventDefault();
		confirmation = { geste: 'quitter' };
	}

	const confirmer: SubmitFunction = () => {
		const c = confirmation;
		return async ({ result, update }) => {
			dialogue?.close();
			confirmation = null;
			await update();
			await tick();
			if (!c || c.geste === 'quitter') return;
			if (result.type === 'success' && c.geste === 'retirer') {
				dire(`${c.m.prenom} ne fait plus partie du groupe.`);
				document.getElementById('t-membres')?.focus();
			} else {
				if (result.type === 'success') dire(`${c.m.prenom} anime maintenant le groupe.`);
				bouton(c.m.id)?.focus();
			}
		};
	};
</script>

<svelte:head>
	<title>{groupe ? 'Infos du groupe' : 'Infos'} · {infos.nom} · Gyro Caserne</title>
</svelte:head>

{#snippet cadenas()}
	<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
{/snippet}

<div class="page">
	<header class="barre-haut">
		<a class="retour" href="/echanges/messages/{data.id}" aria-label="Retour à la conversation"
			><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg></a
		>
		<span class="titre-barre">{groupe ? 'Infos du groupe' : 'Infos de la conversation'}</span>
	</header>

	<p class="masque" role="status">{annonce}</p>
	<p class="erreur" class:masque={!erreur} role="alert">{erreur}</p>

	{#if groupe}
		<section class="tete" bind:this={tete}>
			<span class="icone" aria-hidden="true" style:background="var(--icone-{icone}-fond)" style:color="var(--icone-{icone}-texte)"
				><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d={ICONES_ROLES[icone]} /></svg></span
			>
			<h1>{infos.nom}</h1>
			<p class="resume">{resumeGroupe({ membres: infos.membres.length, creePar: infos.creePar, creeParPrenom: infos.creeParPrenom }, data.moiId)}</p>
			{#if data.mode === 'renommer'}
				<form method="POST" action="?/renommer" class="renommer" use:enhance>
					<Champ id="groupe-nom" name="nom" libelle="Nouveau nom du groupe" valeur={form?.cible === 'renommer' ? (form.valeurs?.nom ?? '') : infos.nom} erreur={form?.cible === 'renommer' ? form.message : undefined} requis maxlength={60} />
					<div class="choix">
						<a class="secondaire" href={retourInfos}>Annuler</a>
						<button type="submit" class="principal">Enregistrer</button>
					</div>
				</form>
			{:else}
				<a class="pilule" href="?renommer">Renommer</a>
			{/if}
			<p class="prive">{@render cadenas()}Seuls les membres lisent ce groupe.</p>
		</section>

		<section class="carte" aria-labelledby="t-membres">
			<h2 id="t-membres" tabindex="-1">{pluriel(infos.membres.length)}</h2>
			{#if infos.moiAnimateur}
				<a class="ligne ajouter" href="/echanges/messages/nouveau/groupe?ajouter={data.id}">
					<span class="plus" aria-hidden="true">+</span>
					<strong>Ajouter des membres</strong>
				</a>
			{/if}
			<ul>
				{#each infos.membres as m (m.id)}
					{@const moi = m.id === data.moiId}
					<li class="ligne">
						<Visage prenom={m.prenom} nom={m.nom} couleur={m.equipe?.couleur ?? null} taille={44} />
						<span class="textes">
							<strong>{moi ? 'Vous' : nomComplet(m)}</strong>
							{#if sous(m)}<span class="sous">{sous(m)}</span>{/if}
						</span>
						{#if m.animateur}<span class="animateur">Animateur</span>{/if}
						{#if !moi}
							<span class="actions">
								<button
									type="button"
									class="points"
									id="actions-{m.id}"
									hidden={!js}
									aria-haspopup="menu"
									aria-expanded={menuOuvert === m.id}
									aria-controls={menuOuvert === m.id ? `menu-${m.id}` : undefined}
									aria-label="Actions pour {nomComplet(m)}"
									onclick={() => (menuOuvert = menuOuvert === m.id ? null : m.id)}
									><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg></button
								>
								{#if menuOuvert === m.id}
									<MenuGestes id="menu-{m.id}" etiquette="actions-{m.id}" gestes={gestesMembre(m, infos.moiAnimateur)} choisir={(g) => choisir(m, g)} {fermer} />
								{/if}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section class="carte">
			{#if data.mode === 'quitter'}
				<form method="POST" action="?/quitter" class="confirmer-ici" use:enhance>
					<h2>Quitter « {infos.nom} » ?</h2>
					<p>Vous ne lirez plus ses messages. Pour revenir, un animateur devra vous ajouter.</p>
					<div class="choix">
						<a class="secondaire" href={retourInfos}>Annuler</a>
						<button type="submit" class="danger">Quitter le groupe</button>
					</div>
				</form>
			{:else}
				<a class="quitter" id="quitter" href="?quitter" onclick={js ? quitter : undefined}
					><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" /></svg>Quitter le groupe</a
				>
			{/if}
		</section>
	{:else if autre}
		<section class="tete">
			<Visage prenom={autre.prenom} nom={autre.nom} couleur={autre.equipe?.couleur ?? null} taille={88} />
			<h1>{infos.nom}</h1>
			{#if sous(autre)}<p class="resume">{sous(autre)}</p>{/if}
			<p class="prive">{@render cadenas()}Seuls vous deux lisez cette conversation.</p>
		</section>

		<section class="carte" aria-labelledby="t-fiche">
			<h2 id="t-fiche">Fiche courte</h2>
			<dl>
				<div class="ligne"><dt>Équipe</dt><dd>{autre.equipe ? `Équipe ${autre.equipe.numero}` : 'Aucune'}</dd></div>
				{#if autre.role}<div class="ligne"><dt>Rôle</dt><dd>{autre.role}</dd></div>{/if}
				{#if autre.telephone}
					<div class="ligne"><dt>Téléphone</dt><dd><a href="tel:{chiffres(autre.telephone)}">{autre.telephone}</a></dd></div>
				{/if}
			</dl>
			{#if data.fiche}
				<a class="ligne lien" href={data.fiche}
					>Voir la fiche<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg></a
				>
			{/if}
		</section>
	{/if}
</div>

{#if confirmation}
	{@const c = confirmation}
	<dialog class="confirmation" bind:this={dialogue} aria-labelledby="confirmation-titre" aria-describedby="confirmation-texte" onclose={() => confirmation && fermerConfirmation()}>
		<form method="POST" action="?/{c.geste}" use:enhance={confirmer}>
			{#if c.geste === 'quitter'}
				<h2 id="confirmation-titre">Quitter « {infos.nom} » ?</h2>
				<p id="confirmation-texte">Vous ne lirez plus ses messages. Pour revenir, un animateur devra vous ajouter.</p>
			{:else if c.geste === 'retirer'}
				<input type="hidden" name="personne" value={c.m.id} />
				<h2 id="confirmation-titre">Retirer {c.m.prenom} du groupe ?</h2>
				<p id="confirmation-texte">{c.m.prenom} ne lira plus le groupe, ni ses anciens messages.</p>
			{:else}
				<input type="hidden" name="personne" value={c.m.id} />
				<h2 id="confirmation-titre">Nommer {c.m.prenom} animateur ?</h2>
				<p id="confirmation-texte">{c.m.prenom} pourra ajouter et retirer des membres, et nommer d’autres animateurs.</p>
			{/if}
			<div class="choix">
				<!-- svelte-ignore a11y_autofocus -->
				<button type="button" class="secondaire" autofocus onclick={fermerConfirmation}>Annuler</button>
				<button type="submit" class={c.geste === 'nommer' ? 'principal' : 'danger'}>{c.geste === 'quitter' ? 'Quitter' : c.geste === 'retirer' ? 'Retirer' : 'Nommer'}</button>
			</div>
		</form>
	</dialog>
{/if}

<style>
	/* À l'ordinateur, la page garde une largeur de lecture. */
	.page {
		max-width: 40rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.barre-haut {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: -8px;
	}
	.retour {
		width: var(--cible);
		height: var(--cible);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: var(--encre);
	}
	.retour:hover {
		background: var(--trait-doux);
	}
	.titre-barre {
		font-weight: 600;
	}

	.tete,
	.carte {
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-radius: var(--rayon-grand);
	}
	.tete {
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		text-align: center;
	}
	.icone {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	h1 {
		margin: 0;
		font: 700 1.75rem/1.15 var(--police-titre);
		overflow-wrap: anywhere;
	}
	.resume {
		margin: 0;
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.pilule {
		min-height: var(--cible);
		padding: 0 18px;
		border: 1px solid var(--statut-neutre-trait);
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.pilule:hover {
		background: var(--fond);
	}
	.prive {
		margin: 4px 0 0;
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--doux);
		font-size: 0.875rem;
	}
	.renommer {
		width: 100%;
		max-width: 24rem;
		display: flex;
		flex-direction: column;
		gap: 10px;
		text-align: left;
	}

	.carte {
		padding: 4px 0;
		overflow: visible;
	}
	.carte h2 {
		margin: 0;
		padding: 12px 16px 6px;
		color: var(--doux);
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ligne {
		position: relative;
		min-height: 60px;
		padding: 6px 8px 6px 16px;
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.ajouter,
	.lien {
		color: var(--encre);
		text-decoration: none;
	}
	.ajouter:hover,
	.lien:hover {
		background: var(--fond);
	}
	.plus {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 1.625rem;
		line-height: 1;
	}
	.textes {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.textes strong {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.sous {
		color: var(--doux);
		font-size: 0.875rem;
	}
	.animateur {
		flex: none;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		font-size: 0.8125rem;
		font-weight: 700;
	}
	.actions {
		position: relative;
		flex: none;
	}
	.points {
		width: var(--cible);
		height: var(--cible);
		border: 0;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		color: var(--doux);
		cursor: pointer;
	}
	.points[hidden] {
		display: none;
	}
	.points:hover,
	.points[aria-expanded='true'] {
		background: var(--fond);
		color: var(--encre);
	}
	.actions :global(.menu) {
		right: 0;
	}
	/* Les membres sans menu gardent l'alignement de la pastille. */
	li.ligne:not(:has(.actions)) {
		padding-right: 60px;
	}

	.quitter {
		min-height: 56px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--statut-danger-texte);
		font-weight: 600;
		text-decoration: none;
	}
	.quitter:hover {
		background: var(--fond);
	}
	.confirmer-ici {
		padding: 8px 16px 12px;
	}
	.confirmer-ici h2 {
		padding: 4px 0 8px;
		color: var(--encre);
		font: 700 1.25rem var(--police-titre);
		letter-spacing: 0;
		text-transform: none;
	}
	.confirmer-ici p {
		margin: 0 0 16px;
		color: var(--doux);
	}

	dl {
		margin: 0;
	}
	dl .ligne {
		justify-content: space-between;
		min-height: 52px;
		padding-right: 16px;
		border-top: 1px solid var(--trait-doux);
	}
	dl .ligne:first-child {
		border-top: 0;
	}
	dt {
		color: var(--doux);
	}
	dd {
		margin: 0;
		font-weight: 600;
		text-align: right;
	}
	dd a {
		color: var(--statut-info-texte);
	}
	.lien {
		justify-content: space-between;
		padding-right: 16px;
		border-top: 1px solid var(--trait-doux);
		font-weight: 600;
	}
	.lien svg {
		color: var(--doux);
	}

	.choix {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.choix a,
	.choix button {
		min-height: var(--cible);
		padding: 0 18px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		font: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}
	.secondaire {
		border: 1px solid var(--statut-neutre-trait);
		background: var(--surface);
		color: var(--encre);
	}
	.principal,
	.danger {
		border: 2px solid var(--encre);
		background: var(--rouge);
		color: var(--sur-rouge);
	}

	.confirmation {
		max-width: min(24rem, calc(100vw - 32px));
		padding: 20px;
		border: 0;
		border-radius: 20px;
		background: var(--surface);
		color: var(--encre);
	}
	.confirmation::backdrop {
		background: color-mix(in srgb, #000 45%, transparent);
	}
	.confirmation h2 {
		margin: 0 0 8px;
		font: 700 1.25rem var(--police-titre);
	}
	.confirmation p {
		margin: 0 0 16px;
		color: var(--doux);
	}

	.erreur {
		margin: 0;
		padding: 10px 14px;
		border: 1px solid var(--statut-danger-trait);
		border-radius: var(--rayon-petit);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>

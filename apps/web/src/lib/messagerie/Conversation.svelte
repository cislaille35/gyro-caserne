<script lang="ts">
	import type { VueConversation, VueMessage } from '@gyro-caserne/socle';
	import { applyAction, deserialize, type ActionResult } from '$app/forms';
	import { afterNavigate, goto } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
	import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
	import { heure } from '#lib/murs/quand.ts';
	import Bulle from '#lib/ui/Bulle.svelte';
	import { ICONES_ROLES } from '#lib/ui/icones-roles.ts';
	import Vide from '#lib/ui/Vide.svelte';
	import Visage from '#lib/ui/Visage.svelte';
	import MenuGestes, { type Geste } from './MenuGestes.svelte';
	import { bandeauNonLus, fusionner, regrouper } from './regrouper.ts';
	import Saisie from './Saisie.svelte';
	import { suivreConversation } from './suite.ts';

	type Reponse = { cible?: string; message?: string; succes?: string; valeurs?: { texte: string; reponseA: string } } | null | undefined;

	let {
		vue,
		moiId,
		sousTitre,
		avant = null,
		autrePrenom = null,
		nouvelle = null,
		form = null
	}: {
		vue: VueConversation;
		moiId: number;
		sousTitre: string;
		// Une page de messages plus anciens (sans JavaScript).
		avant?: number | null;
		autrePrenom?: string | null;
		// La personne à qui l'on écrit pour la première fois : la conversation naîtra au premier message.
		nouvelle?: { id: number; prenom: string } | null;
		form?: Reponse;
	} = $props();

	const id = untrack(() => vue.id);
	let messages = $state(untrack(() => vue.messages));
	let plusAnciens = $state(untrack(() => vue.plusAnciens));
	// Le bandeau reste à sa place tant que la conversation est ouverte.
	const bandeau = untrack(() => (avant === null ? bandeauNonLus(vue.messages, vue.premierNonLu) : null));
	const elements = $derived(regrouper(messages, { aujourdhui: aujourdhuiParis(), bandeau }));
	const groupe = $derived(vue.type === 'groupe');
	const autre = $derived(vue.membres.find((m) => m.id !== moiId) ?? null);
	type Icone = keyof typeof ICONES_ROLES;
	const icone = $derived<Icone>(vue.icone && vue.icone in ICONES_ROLES ? (vue.icone as Icone) : 'groupe');

	let js = $state(false);
	let exclu = $state('');
	const actif = $derived(!vue.lectureSeule && !exclu);
	let annonce = $state(untrack(() => (form?.cible === 'geste' ? (form.succes ?? form.message ?? '') : '')));
	let saisie = $state<ReturnType<typeof Saisie>>();

	// Défilement de la page : on ne descend jamais de force quand la personne lit plus haut.
	let loinDuBas = $state(false);
	let nouveauxEnDessous = $state(0);
	let forcerBas = false;
	const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
	const enBas = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 96;
	function allerEnBas(doux = true) {
		window.scrollTo({ top: document.documentElement.scrollHeight, behavior: doux && !calme() ? 'smooth' : 'auto' });
		nouveauxEnDessous = 0;
	}
	function surDefilement() {
		loinDuBas = !enBas();
		if (!loinDuBas) nouveauxEnDessous = 0;
	}

	let suivi: ReturnType<typeof suivreConversation> | null = null;
	onMount(() => {
		js = true;
		window.addEventListener('scroll', surDefilement, { passive: true });
		if (!nouvelle && avant === null) {
			const dernier = messages.at(-1)?.id ?? 0;
			suivi = suivreConversation(id, { dernierId: dernier, majLe: vue.majLe }, { recu, exclu: (m) => (exclu = m) });
		}
		return () => {
			window.removeEventListener('scroll', surDefilement);
			suivi?.arreter();
		};
	});
	// À l'ouverture (après le placement de la page par SvelteKit) : au premier non lu, sinon en bas.
	let place = false;
	afterNavigate(({ to }) => {
		if (place) return;
		place = true;
		if (to?.url.hash || avant !== null) return;
		const repere = bandeau ? document.getElementById('non-lus') : null;
		if (repere) repere.scrollIntoView({ block: 'start' });
		else allerEnBas(false);
		surDefilement();
	});

	async function recu(nouveaux: VueMessage[], modifies: VueMessage[]) {
		const arrives = nouveaux.filter((n) => !messages.some((m) => m.id === n.id));
		const etaitEnBas = enBas();
		messages = fusionner(messages, [...modifies, ...nouveaux]);
		if (arrives.length === 0) return;
		await tick();
		if (forcerBas || etaitEnBas) allerEnBas();
		else nouveauxEnDessous += arrives.filter((m) => !m.moi).length;
		forcerBas = false;
		surDefilement();
	}

	async function chargerAnciens(e: MouseEvent) {
		const premier = messages[0]?.id;
		if (!premier) return;
		e.preventDefault();
		try {
			const r = await fetch(`/echanges/messages/${id}/suite?avant=${premier}`);
			if (!r.ok) return;
			const page = (await r.json()) as { messages: VueMessage[]; plusAnciens: boolean };
			const hauteur = document.documentElement.scrollHeight;
			messages = fusionner(messages, page.messages);
			plusAnciens = page.plusAnciens;
			await tick();
			// La page garde sous les yeux ce qu'on lisait.
			window.scrollBy(0, document.documentElement.scrollHeight - hauteur);
		} catch {
			annonce = 'Les messages plus anciens n’ont pas pu être chargés.';
		}
	}

	async function apresEnvoi(resultat: ActionResult) {
		if (nouvelle) return applyAction(resultat);
		if (avant !== null) return goto(`/echanges/messages/${id}`);
		forcerBas = true;
		await suivi?.relancer();
	}

	// Un geste envoyé sans recharger la page ; la phrase de réussite ou de refus est annoncée.
	async function poster(action: string, champs: Record<string, string>) {
		const corps = new FormData();
		for (const [cle, valeur] of Object.entries(champs)) corps.append(cle, valeur);
		try {
			const r = await fetch(`/echanges/messages/${id}?/${action}`, { method: 'POST', body: corps, headers: { accept: 'application/json', 'x-sveltekit-action': 'true' } });
			const resultat = deserialize(await r.text());
			if (resultat.type === 'success') {
				if (action !== 'reagir') dire((resultat.data as { succes?: string } | undefined)?.succes ?? '');
				await suivi?.relancer();
			} else dire(resultat.type === 'failure' ? ((resultat.data as { message?: string } | undefined)?.message ?? 'Le geste n’a pas abouti.') : 'Le geste n’a pas abouti. Réessayez.');
		} catch {
			dire('Le geste n’a pas abouti. Réessayez.');
		}
	}
	let minuteurAnnonce: ReturnType<typeof setTimeout> | undefined;
	function dire(phrase: string) {
		annonce = phrase;
		clearTimeout(minuteurAnnonce);
		if (phrase) minuteurAnnonce = setTimeout(() => (annonce = ''), 5000);
	}

	// Le menu des gestes d'un message.
	let menuOuvert = $state<number | null>(null);
	const bouton = (m: number) => document.getElementById(`gestes-${m}`);
	function ouvrir(m: number) {
		menuOuvert = menuOuvert === m ? null : m;
	}
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

	const instant = (iso: string) => Date.parse(`${iso.slice(0, 19).padEnd(19, ':00')}Z`);
	const modifiable = (m: VueMessage) => instant(maintenantParis()) - instant(m.cree_le) <= 15 * 60_000;
	function gestesDe(m: VueMessage): Geste[] {
		const g: Geste[] = [];
		if (actif) g.push('repondre');
		if (m.texte) g.push('copier');
		if (m.moi && actif && modifiable(m)) g.push('modifier');
		g.push(m.moi ? 'supprimer' : 'signaler');
		return g;
	}
	const qui = (m: VueMessage) => (m.moi ? 'votre message' : `le message de ${m.auteur?.prenom ?? 'un ancien membre'}`);

	// Supprimer et signaler demandent une confirmation.
	let confirmation = $state<{ geste: 'supprimer' | 'signaler'; m: VueMessage } | null>(null);
	let dialogue = $state<HTMLDialogElement>();
	$effect(() => {
		if (confirmation && dialogue && !dialogue.open) dialogue.showModal();
	});
	function fermerConfirmation(confirme: boolean) {
		const c = confirmation;
		dialogue?.close();
		confirmation = null;
		if (!c) return;
		bouton(c.m.id)?.focus();
		if (confirme) void poster(c.geste, { id: String(c.m.id) });
	}

	async function choisir(m: VueMessage, geste: Geste) {
		fermer(geste === 'copier');
		if (geste === 'repondre') saisie?.repondre(m);
		else if (geste === 'modifier') saisie?.modifier(m);
		else if (geste === 'copier') {
			try {
				await navigator.clipboard.writeText(m.texte);
				dire('Texte copié.');
			} catch {
				dire('La copie n’a pas marché.');
			}
		} else confirmation = { geste, m };
	}
	function reagir(m: VueMessage, emoji: string) {
		fermer(true);
		void poster('reagir', { id: String(m.id), emoji });
	}

	function allerA(cible: number) {
		const noeud = document.getElementById(`message-${cible}`);
		if (!noeud) return;
		noeud.scrollIntoView({ block: 'center', behavior: calme() ? 'auto' : 'smooth' });
		noeud.focus({ preventScroll: true });
	}

	// Au doigt : un appui long ouvre le menu ; glisser la bulle vers la droite répond (jamais seul : le menu le propose aussi).
	// « Réduire les animations » coupe le glissement.
	function toucher(noeud: HTMLElement, m: VueMessage) {
		let message = m;
		let depart: { x: number; y: number; pointeur: number } | null = null;
		let minuteur: ReturnType<typeof setTimeout> | undefined;
		let glisse = false;
		let ecart = 0;
		let appuiLong = false;
		let doigt = false;
		const remettre = () => {
			noeud.style.transform = '';
			noeud.classList.remove('glisse');
		};
		const bas = (e: PointerEvent) => {
			doigt = e.pointerType === 'touch';
			if (!doigt || !actif) return;
			depart = { x: e.clientX, y: e.clientY, pointeur: e.pointerId };
			glisse = false;
			ecart = 0;
			minuteur = setTimeout(() => {
				depart = null;
				appuiLong = true;
				menuOuvert = message.id;
			}, 500);
		};
		const bouge = (e: PointerEvent) => {
			if (!depart || e.pointerId !== depart.pointeur) return;
			const x = e.clientX - depart.x;
			const y = e.clientY - depart.y;
			if (Math.abs(x) > 8 || Math.abs(y) > 8) clearTimeout(minuteur);
			if (!glisse && x > 12 && Math.abs(y) < x / 2 && !calme()) {
				glisse = true;
				noeud.classList.add('glisse');
				noeud.setPointerCapture(e.pointerId);
			}
			if (glisse) {
				ecart = Math.max(0, Math.min(x, 80));
				noeud.style.transform = `translateX(${ecart}px)`;
			}
		};
		const haut = () => {
			clearTimeout(minuteur);
			if (glisse && ecart >= 56) saisie?.repondre(message);
			depart = null;
			glisse = false;
			remettre();
		};
		const menuContextuel = (e: Event) => {
			if (doigt) e.preventDefault();
		};
		// Après un appui long, le doigt levé ne doit pas ouvrir la photo ou la citation.
		const clic = (e: Event) => {
			if (!appuiLong) return;
			appuiLong = false;
			e.preventDefault();
			e.stopPropagation();
		};
		noeud.addEventListener('pointerdown', bas);
		noeud.addEventListener('pointermove', bouge);
		noeud.addEventListener('pointerup', haut);
		noeud.addEventListener('pointercancel', haut);
		noeud.addEventListener('contextmenu', menuContextuel);
		noeud.addEventListener('click', clic, true);
		return {
			update(nouveau: VueMessage) {
				message = nouveau;
			},
			destroy() {
				clearTimeout(minuteur);
				noeud.removeEventListener('pointerdown', bas);
				noeud.removeEventListener('pointermove', bouge);
				noeud.removeEventListener('pointerup', haut);
				noeud.removeEventListener('pointercancel', haut);
				noeud.removeEventListener('contextmenu', menuContextuel);
				noeud.removeEventListener('click', clic, true);
			}
		};
	}
	const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
</script>

<div class="conversation">
	<header class="entete">
		<a class="retour" href="/echanges/messages" aria-label="Retour aux messages"
			><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg></a
		>
		<svelte:element this={nouvelle ? 'div' : 'a'} class="qui" href={nouvelle ? undefined : `/echanges/messages/${id}/infos`}>
			{#if groupe}
				<span class="icone" aria-hidden="true" style:background="var(--icone-{icone}-fond)" style:color="var(--icone-{icone}-texte)"
					><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={ICONES_ROLES[icone]} /></svg></span
				>
			{:else if autre}
				<Visage prenom={autre.prenom} nom={autre.nom} couleur={autre.couleur} taille={44} />
			{/if}
			<span class="titres">
				<h1>{vue.nom}</h1>
				{#if sousTitre}<span class="sous">{sousTitre}</span>{/if}
			</span>
		</svelte:element>
	</header>

	<div class="fil" role="log" aria-label="Messages de {vue.nom}">
		{#if plusAnciens && messages.length > 0}
			<p class="pages"><a href="?avant={messages[0]!.id}" onclick={chargerAnciens}>Messages plus anciens</a></p>
		{/if}
		{#if nouvelle && messages.length === 0}
			<Vide texte="Écrivez votre premier message à {nouvelle.prenom}." />
		{/if}
		{#each elements as e (e.cle)}
			{#if e.type === 'jour'}
				<p class="jour"><span>{e.libelle}</span></p>
			{:else if e.type === 'non-lus'}
				<p class="non-lus" id="non-lus">{pluriel(e.nombre, 'message')} non {e.nombre > 1 ? 'lus' : 'lu'}</p>
			{:else if e.type === 'systeme'}
				<Bulle message={e.message} conversation={id} {moiId} {groupe} premiere actif={false} />
			{:else}
				<div class="bloc" class:moi={e.moi}>
					{#each e.messages as m, i (m.id)}
						<div class="rangee" class:moi={m.moi} use:toucher={m}>
							<Bulle message={m} conversation={id} {moiId} {groupe} premiere={i === 0} {actif} {allerA} reagir={(n, emoji) => void poster('reagir', { id: String(n), emoji })} />
							{#if m.supprime === null && !exclu}
								<button
									type="button"
									class="gestes"
									id="gestes-{m.id}"
									hidden={!js}
									aria-haspopup="menu"
									aria-expanded={menuOuvert === m.id}
									aria-controls={menuOuvert === m.id ? `menu-${m.id}` : undefined}
									aria-label="Gestes sur {qui(m)}, {heure(m.cree_le)}"
									onclick={() => ouvrir(m.id)}
									><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg
									></button
								>
								{#if menuOuvert === m.id}
									<MenuGestes
										id="menu-{m.id}"
										etiquette="gestes-{m.id}"
										reactions={actif && !m.supprime}
										maReaction={m.reactions.find((r) => r.deMoi)?.emoji ?? null}
										gestes={gestesDe(m)}
										choisir={(g) => choisir(m, g)}
										reagir={(emoji) => reagir(m, emoji)}
										{fermer}
									/>
								{/if}
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/each}
		{#if avant !== null}
			<p class="pages"><a href="/echanges/messages/{id}">Messages plus récents</a></p>
		{/if}
	</div>

	<div class="bas">
		{#if loinDuBas && js}
			<button type="button" class="descendre" aria-label={nouveauxEnDessous > 0 ? `${pluriel(nouveauxEnDessous, 'nouveau message')}, aller en bas` : 'Aller aux derniers messages'} onclick={() => allerEnBas()}
				><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg
				>{#if nouveauxEnDessous > 0}<span class="nombre" aria-hidden="true">{nouveauxEnDessous > 99 ? '99+' : nouveauxEnDessous}</span>{/if}</button
			>
		{/if}
		<p class="annonce" class:visible={annonce} role="status">{annonce}</p>
		{#if exclu}
			<p class="fin">{exclu}</p>
		{:else if vue.lectureSeule}
			<p class="fin">{autrePrenom ?? 'Cette personne'} n’est plus dans l’annuaire.</p>
		{:else}
			<Saisie
				bind:this={saisie}
				cle={nouvelle ? `a-${nouvelle.id}` : String(id)}
				texteInitial={form?.cible === 'envoyer' ? (form.valeurs?.texte ?? '') : ''}
				erreurInitiale={form?.cible === 'envoyer' ? (form.message ?? '') : ''}
				apres={apresEnvoi}
			/>
		{/if}
	</div>
</div>

{#if confirmation}
	<dialog class="confirmation" bind:this={dialogue} aria-labelledby="confirmation-titre" aria-describedby="confirmation-texte" onclose={() => confirmation && fermerConfirmation(false)}>
		{#if confirmation.geste === 'supprimer'}
			<h2 id="confirmation-titre">Supprimer ce message ?</h2>
			<p id="confirmation-texte">Il disparaît pour tout le monde. « Message supprimé » reste à sa place.</p>
		{:else}
			<h2 id="confirmation-titre">Signaler ce message ?</h2>
			<p id="confirmation-texte">Seul ce message est transmis au chef de centre, sans le reste de la conversation.</p>
		{/if}
		<div class="choix">
			<!-- svelte-ignore a11y_autofocus -->
			<button type="button" class="secondaire" autofocus onclick={() => fermerConfirmation(false)}>Annuler</button>
			<button type="button" class="danger" onclick={() => fermerConfirmation(true)}>{confirmation.geste === 'supprimer' ? 'Supprimer' : 'Signaler'}</button>
		</div>
	</dialog>
{/if}

<style>
	/* La conversation occupe toute la place : l'en-tête reste en haut, la saisie en bas. */
	.conversation {
		margin: -1rem -1rem -6rem;
		/* Sous l'en-tête de l'appli (69 px). */
		min-height: calc(100dvh - 69px);
		display: flex;
		flex-direction: column;
		background: var(--fond);
	}
	.entete {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px 8px 4px;
		background: var(--surface);
		border-bottom: 1px solid var(--trait-doux);
	}
	.retour {
		flex: none;
		width: var(--cible);
		height: var(--cible);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: var(--encre);
	}
	.qui {
		flex: 1;
		min-width: 0;
		min-height: 48px;
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--encre);
		text-decoration: none;
	}
	a.qui:hover h1 {
		text-decoration: underline;
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
	.titres {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	h1 {
		margin: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font: 700 1.25rem/1.15 var(--police-titre);
	}
	.sous {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--doux);
		font-size: 0.8125rem;
	}

	.fil {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 12px 10px 16px;
	}
	.fil :global([id^='message-']),
	.non-lus {
		scroll-margin: 80px 0 140px;
	}
	.pages {
		margin: 4px 0 8px;
		text-align: center;
	}
	.pages a {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 16px;
		color: var(--statut-info-texte);
		font-weight: 600;
	}
	.jour {
		margin: 10px 0 6px;
		text-align: center;
	}
	.jour span {
		display: inline-block;
		padding: 4px 12px;
		border-radius: 999px;
		background: var(--trait-doux);
		color: var(--doux);
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.non-lus {
		margin: 4px -10px 8px;
		padding: 6px;
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		font-size: 0.8125rem;
		font-weight: 700;
		text-align: center;
	}
	.bloc {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 6px;
	}
	.rangee {
		position: relative;
		display: flex;
		align-items: center;
		gap: 2px;
		touch-action: pan-y;
	}
	.rangee.moi {
		flex-direction: row-reverse;
	}
	.rangee:global(.glisse) {
		transition: none;
	}
	.rangee {
		transition: transform 0.15s;
	}
	.rangee :global(.menu) {
		left: 0;
	}
	.rangee.moi :global(.menu) {
		left: auto;
		right: 0;
	}
	.gestes {
		flex: none;
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
		opacity: 0;
	}
	.gestes[hidden] {
		display: none;
	}
	.rangee:hover .gestes,
	.gestes:focus-visible,
	.gestes[aria-expanded='true'] {
		opacity: 1;
	}
	.gestes:hover {
		background: var(--trait-doux);
	}
	/* Au doigt, l'appui long ouvre le menu : le bouton n'apparaît qu'au clavier ou au lecteur d'écran. */
	@media (hover: none) {
		.gestes:not(:focus-visible):not([aria-expanded='true']) {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
		.rangee {
			-webkit-touch-callout: none;
			user-select: none;
		}
	}

	.bas {
		position: sticky;
		bottom: 0;
		z-index: 5;
		/* Au téléphone, la barre de navigation passe par-dessus le bas de la saisie. */
		padding-bottom: calc(3.5rem + 1px + env(safe-area-inset-bottom));
		background: var(--surface);
		border-top: 1px solid var(--trait-doux);
	}
	.descendre {
		position: absolute;
		top: -60px;
		right: 14px;
		width: 48px;
		height: 48px;
		border: 1px solid var(--trait);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface);
		color: var(--encre);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--encre) 18%, transparent);
		cursor: pointer;
	}
	.descendre .nombre {
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 22px;
		height: 22px;
		padding: 0 5px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: 0.75rem;
		font-weight: 700;
	}
	.annonce {
		position: absolute;
		bottom: calc(100% + 12px);
		left: 50%;
		translate: -50% 0;
		margin: 0;
		padding: 0;
		width: max-content;
		max-width: calc(100% - 32px);
	}
	.annonce.visible {
		padding: 8px 14px;
		border-radius: 999px;
		background: var(--encre);
		color: var(--surface);
		font-size: 0.875rem;
		font-weight: 600;
	}
	.fin {
		margin: 0;
		padding: 16px;
		color: var(--doux);
		text-align: center;
		font-weight: 600;
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
	.choix {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.choix button {
		min-height: var(--cible);
		padding: 0 18px;
		border-radius: 999px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.secondaire {
		border: 1px solid var(--trait);
		background: var(--surface);
		color: var(--encre);
	}
	.danger {
		border: 0;
		background: var(--rouge);
		color: var(--sur-rouge);
	}

	@media (min-width: 1024px) {
		.conversation {
			margin: -1rem -1rem -1.5rem;
		}
		.bas {
			padding-bottom: 0;
		}
		.fil {
			padding: 16px 24px;
		}
	}
</style>

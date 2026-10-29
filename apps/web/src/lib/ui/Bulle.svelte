<script module lang="ts">
	const lumiere = (hex: string) => {
		const [r, g, b] = [1, 3, 5].map((i) => {
			const c = parseInt(hex.slice(i, i + 2), 16) / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
	};
	export function contraste(a: string, b: string): number {
		const [x, y] = [lumiere(a), lumiere(b)].sort((p, q) => q - p);
		return (x! + 0.05) / (y! + 0.05);
	}
	const melanger = (hex: string, vers: number, part: number) =>
		`#${[1, 3, 5]
			.map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - part) + vers * part))
			.map((c) => c.toString(16).padStart(2, '0'))
			.join('')}`;
	// Mélangée au noir (ou au blanc) pas à pas, jusqu'au contraste AA sur le fond de la bulle.
	const lisible = (hex: string, fond: string, vers: number) => {
		for (let part = 0; part <= 1; part += 0.05) {
			const teinte = melanger(hex, vers, part);
			if (contraste(teinte, fond) >= 4.5) return teinte;
		}
		return vers === 0 ? '#000000' : '#ffffff';
	};
	// Le nom de l'auteur prend la couleur de son équipe, rendue lisible en clair et en sombre ; null sans équipe.
	export function teinteNom(couleur: string | null): { clair: string; sombre: string } | null {
		if (!couleur || !/^#[0-9a-f]{6}$/i.test(couleur)) return null;
		const hex = couleur.toLowerCase();
		return { clair: lisible(hex, '#ffffff', 0), sombre: lisible(hex, '#1a222c', 255) };
	}
</script>

<script lang="ts">
	import type { VueMessage } from '@gyro-caserne/socle';
	import { heure } from '#lib/murs/quand.ts';

	let {
		message: m,
		conversation,
		moiId,
		groupe,
		premiere,
		actif,
		allerA,
		reagir
	}: {
		message: VueMessage;
		conversation: number;
		moiId: number;
		groupe: boolean;
		// Première bulle d'un bloc : le nom (dans un groupe) et la pointe.
		premiere: boolean;
		// Les réactions se touchent (pas en lecture seule).
		actif: boolean;
		// Avec JavaScript : remonter au message cité, réagir sans recharger.
		allerA?: (id: number) => void;
		reagir?: (id: number, emoji: string) => void;
	} = $props();

	const qui = $derived(m.moi ? 'Vous' : (m.auteur?.prenom ?? 'Un ancien membre'));
	const nomVisible = $derived(groupe && premiere && !m.moi);
	const teinte = $derived(teinteNom(m.auteur?.couleur ?? null));
	const photoSeule = $derived(m.photos.length > 0 && !m.texte && m.supprime === null);
	const cite = $derived(m.reponse ? (m.reponse.auteur?.id === moiId ? 'Vous' : (m.reponse.auteur?.prenom ?? 'Un ancien membre')) : '');
	const enTexte = (r: VueMessage['reactions'][number]) => `${r.emoji} ${r.nombre}${r.deMoi ? (r.nombre > 1 ? ', dont vous' : ', vous') : ''}`;
</script>

{#snippet meta()}
	<span class="meta"
			>{#if m.modifie}modifié · {/if}<time datetime={m.cree_le}>{heure(m.cree_le)}</time>{#if m.coche}<span class="coche" class:lu={m.coche === 'lu'} aria-hidden="true"
					>{m.coche === 'lu' ? '✓✓' : '✓'}</span
				><span class="masque">, {m.coche === 'lu' ? 'lu' : 'envoyé'}</span>{/if}</span
		>
{/snippet}

{#if m.systeme !== null}
	<p class="systeme" id="message-{m.id}">{m.systeme}</p>
{:else}
	<div class="bulle" class:moi={m.moi} class:premiere class:photo-seule={photoSeule} class:supprime={m.supprime !== null} id="message-{m.id}" tabindex="-1">
		{#if nomVisible}
			<strong class="auteur" class:teinte style={teinte ? `--clair: ${teinte.clair}; --sombre: ${teinte.sombre}` : undefined}>{qui}</strong>
		{:else}
			<span class="masque">{qui} :</span>
		{/if}
		{#if m.reponse}
			{@const r = m.reponse}
			<a
				class="citation"
				href="#message-{r.id}"
				onclick={(e) => {
					if (!allerA) return;
					e.preventDefault();
					allerA(r.id);
				}}><span class="masque">En réponse à</span> <strong>{cite}</strong> <span class="extrait" class:vide={!r.extrait}>{r.extrait || 'Message supprimé'}</span></a
			>
		{/if}
		{#if m.photos.length > 0}
			<span class="photos" class:plusieurs={m.photos.length > 1}>
				{#each m.photos as p, i (p)}
					<a href="/echanges/messages/{conversation}/photo/{p}"
						><img src="/echanges/messages/{conversation}/photo/{p}" alt={m.photos.length > 1 ? `Photo ${i + 1} sur ${m.photos.length}` : 'Photo'} loading="lazy" /></a
					>
				{/each}
				{#if photoSeule}{@render meta()}{/if}
			</span>
		{/if}
		{#if m.supprime !== null}
			<span class="texte retire">{m.supprime === 'moderation' ? 'Message retiré par la modération' : 'Message supprimé'}</span>
		{:else if m.texte}
			<span class="texte">{m.texte}</span>
		{/if}
		{#if !photoSeule}{@render meta()}{/if}
		{#if m.reactions.length > 0}
			{#if actif}
				<form
					method="POST"
					action="?/reagir"
					class="reactions"
					onsubmit={(e) => {
						if (!reagir || !(e.submitter instanceof HTMLButtonElement)) return;
						e.preventDefault();
						reagir(m.id, e.submitter.value);
					}}
				>
					<input type="hidden" name="id" value={m.id} />
					{#each m.reactions as r (r.emoji)}
						<button type="submit" class="reaction" class:mienne={r.deMoi} name="emoji" value={r.emoji} aria-pressed={r.deMoi} aria-label={enTexte(r)}
							><span aria-hidden="true">{r.emoji} {r.nombre}</span></button
						>
					{/each}
				</form>
			{:else}
				<span class="reactions">
					{#each m.reactions as r (r.emoji)}
						<span class="reaction" class:mienne={r.deMoi}><span aria-hidden="true">{r.emoji} {r.nombre}</span><span class="masque">{enTexte(r)}</span></span>
					{/each}
				</span>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.systeme {
		align-self: center;
		max-width: 85%;
		margin: 6px auto;
		color: var(--doux);
		font-size: 0.8125rem;
		text-align: center;
	}
	.bulle {
		position: relative;
		display: block;
		max-width: min(80%, 36rem);
		padding: 7px 10px 6px;
		border-radius: 16px;
		background: var(--surface);
		color: var(--encre);
		box-shadow: 0 1px 1px color-mix(in srgb, var(--encre) 10%, transparent);
		overflow-wrap: anywhere;
	}
	.bulle:focus {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.premiere {
		border-top-left-radius: 4px;
	}
	.moi {
		align-self: flex-end;
		background: var(--bulle-moi);
	}
	.moi.premiere {
		border-top-left-radius: 16px;
		border-top-right-radius: 4px;
	}
	.auteur {
		display: block;
		font-size: 0.8125rem;
		color: var(--statut-info-texte);
	}
	.auteur.teinte {
		color: var(--clair);
	}
	:global(:root[data-theme='sombre']) .auteur.teinte {
		color: var(--sombre);
	}
	@media (prefers-color-scheme: dark) {
		:global(:root[data-theme='auto']) .auteur.teinte {
			color: var(--sombre);
		}
	}
	.citation {
		display: flex;
		flex-direction: column;
		margin: 2px 0 6px;
		padding: 5px 8px;
		border-left: 3px solid var(--statut-info-texte);
		border-radius: 6px;
		background: color-mix(in srgb, var(--encre) 6%, transparent);
		color: var(--encre);
		font-size: 0.875rem;
		text-decoration: none;
	}
	.citation strong {
		color: var(--statut-info-texte);
		font-size: 0.8125rem;
	}
	.citation .extrait {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.citation .vide {
		font-style: italic;
		color: var(--doux);
	}
	.citation:hover .extrait {
		text-decoration: underline;
	}
	.photos {
		display: grid;
		gap: 3px;
		margin: 0 -6px 6px;
		border-radius: 12px;
		overflow: hidden;
	}
	.photos.plusieurs {
		grid-template-columns: 1fr 1fr;
	}
	.photos a {
		display: block;
	}
	.photos img {
		display: block;
		width: 100%;
		max-width: 260px;
		max-height: 320px;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		background: var(--statut-neutre-fond);
	}
	.plusieurs img {
		width: 130px;
		height: 110px;
	}
	.photo-seule {
		padding: 4px;
	}
	.photo-seule .photos {
		position: relative;
		margin: 0;
	}
	/* Une photo seule : l'heure se pose sur la photo. */
	.photo-seule .meta {
		position: absolute;
		right: 6px;
		bottom: 6px;
		float: none;
		margin: 0;
		padding: 1px 8px;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.6);
		color: #ffffff;
	}
	.photo-seule .coche,
	.photo-seule .coche.lu {
		color: #ffffff;
	}
	.texte {
		white-space: pre-wrap;
	}
	.retire {
		font-style: italic;
		color: var(--doux);
	}
	/* L'heure flotte à droite, sur la dernière ligne du texte s'il reste de la place. */
	.meta {
		float: right;
		display: inline-flex;
		gap: 4px;
		align-items: center;
		margin: 5px 0 -3px 10px;
		color: var(--doux);
		font-size: 0.75rem;
		white-space: nowrap;
	}
	.coche {
		color: var(--doux);
		font-weight: 700;
		letter-spacing: -2px;
	}
	.coche.lu {
		color: var(--statut-info-texte);
	}
	.reactions {
		clear: both;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 4px 0 -18px;
	}
	.reaction {
		min-height: 28px;
		padding: 1px 8px;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--trait-doux);
		border-radius: 999px;
		background: var(--surface);
		color: var(--encre);
		font: inherit;
		font-size: 0.8125rem;
	}
	button.reaction {
		position: relative;
		cursor: pointer;
	}
	/* Cible de 44 px, sans grossir la pastille. */
	button.reaction::after {
		content: '';
		position: absolute;
		inset: -8px -2px;
	}
	.reaction.mienne {
		border-color: var(--statut-info-texte);
		background: var(--statut-info-fond);
		color: var(--statut-info-texte);
		font-weight: 600;
	}
	.bulle:has(.reactions) {
		margin-bottom: 18px;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>

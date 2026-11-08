<script lang="ts">
	import type { ApercuConversation } from '@gyro-caserne/socle';
	import { untrack } from 'svelte';
	import { quand } from '#lib/murs/quand.ts';
	import { ICONES_ROLES } from '#lib/ui/icones-roles.ts';
	import Visage from '#lib/ui/Visage.svelte';
	import { plat } from './recherche.ts';

	// `breve` : la colonne à côté d'une conversation (à l'ordinateur) ; `actif` y est la conversation ouverte, marquée et sans sa pastille.
	let { conversations, q = '', breve = false, actif = null }: { conversations: ApercuConversation[]; q?: string; breve?: boolean; actif?: number | null } = $props();

	// La recherche part de celle reçue sans JavaScript, puis filtre à chaque frappe.
	let recherche = $state(untrack(() => q));
	const visibles = $derived(conversations.filter((c) => plat(c.nom).includes(plat(recherche))));

	const nonLusEnTexte = (n: number) => `${n} ${n > 1 ? 'messages non lus' : 'message non lu'}`;
	// À deux, l'aperçu ne répète pas le prénom de l'autre : son nom est juste au-dessus.
	const apercu = (c: ApercuConversation) => (c.personne && c.apercu.startsWith(`${c.personne.prenom} : `) ? c.apercu.slice(c.personne.prenom.length + 3) : c.apercu);
	type Icone = keyof typeof ICONES_ROLES;
	// Un groupe : son icône sur sa teinte (« groupe » par défaut).
	const icone = (c: ApercuConversation): Icone => (c.icone && c.icone in ICONES_ROLES ? (c.icone as Icone) : 'groupe');
	const nonLus = (c: ApercuConversation) => (c.id === actif ? 0 : c.nonLus);
	const taille = $derived<52 | 44>(breve ? 44 : 52);
</script>

<!-- Sans JavaScript, la recherche mène à la liste. -->
<form class="recherche" method="get" action="/echanges/messages" role="search" onsubmit={(e) => e.preventDefault()}>
	<label for="recherche" class="masque">Rechercher une conversation</label>
	<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
	<input id="recherche" type="search" name="q" bind:value={recherche} placeholder={breve ? 'Rechercher' : 'Rechercher une conversation'} autocomplete="off" />
</form>

<!-- Toujours présent (masqué quand la recherche trouve), pour que le lecteur d'écran annonce une recherche sans résultat. -->
<p class="aucune" class:masque={visibles.length > 0} role="status">{visibles.length === 0 ? 'Aucune conversation à ce nom.' : ''}</p>
{#if visibles.length > 0}
	<ul class="lignes" class:breve>
		{#each visibles as c (c.id)}
			<li>
				<a class="conversation" class:non-lue={nonLus(c) > 0} href="/echanges/messages/{c.id}" aria-current={c.id === actif ? 'page' : undefined}>
					{#if c.type === 'deux'}
						{@const [prenom = '', ...nom] = c.nom.split(' ')}
						<Visage prenom={c.personne?.prenom ?? prenom} nom={c.personne?.nom ?? nom.join(' ')} couleur={c.personne?.couleur ?? null} {taille} />
					{:else}
						<span class="groupe" aria-hidden="true" style:width="{taille}px" style:height="{taille}px" >
							<svg width={taille / 2} height={taille / 2} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={ICONES_ROLES[icone(c)]} /></svg>
						</span>
					{/if}
					<span class="corps">
						<span class="ligne">
							<strong class="nom">{c.nom}</strong>
							<time class="heure" datetime={c.dernier_le}>{quand(c.dernier_le)}</time>
						</span>
						<span class="ligne">
							<span class="apercu">{apercu(c)}</span>
							{#if nonLus(c) > 0}
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

<style>
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
		min-width: 0;
		min-height: var(--cible);
		padding: 0 var(--espace-16) 0 var(--espace-48);
		background: var(--surface);
		color: var(--encre);
		font: inherit;
	}
	input::placeholder {
		color: var(--doux);
	}

	/* Une conversation : une ligne de la carte, toute la ligne est le lien. */
	.conversation {
		min-height: 72px;
		padding: var(--espace-12) var(--espace-16);
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		color: var(--encre);
		text-decoration: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.conversation:hover {
			background: color-mix(in srgb, var(--encre) 4%, var(--surface));
			color: var(--encre);
		}
	}
	.conversation:focus-visible {
		outline-offset: -3px;
	}
	/* À côté d'une conversation : des lignes plus serrées, l'ouverte marquée d'un fond et d'un trait. */
	.breve .conversation {
		min-height: 60px;
		padding: var(--espace-8) var(--espace-12);
		gap: var(--espace-12);
	}
	.conversation[aria-current='page'] {
		background: var(--statut-neutre-fond);
		box-shadow: inset 4px 0 0 var(--accent);
	}
	.groupe {
		flex: none;
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
		gap: var(--espace-8);
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
		font-size: var(--texte-16);
		font-weight: 600;
	}
	.breve .nom {
		font-size: var(--texte-16);
	}
	.heure {
		flex: none;
		color: var(--doux);
		font-size: var(--texte-14);
	}
	.apercu {
		color: var(--doux);
		font-size: var(--texte-15);
	}
	.breve .apercu {
		font-size: var(--texte-14);
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
		padding: 0 var(--espace-8);
		border-radius: var(--rayon-bouton);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--rouge);
		color: var(--sur-rouge);
		font-size: var(--texte-12);
		font-weight: 700;
	}

	.aucune,
	.confidentialite {
		margin: var(--espace-8) var(--espace-16) 0;
		color: var(--doux);
		font-size: var(--texte-14);
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
</style>

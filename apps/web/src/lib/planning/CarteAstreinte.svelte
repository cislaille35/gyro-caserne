<script lang="ts">
	import type { Astreinte } from '@gyro-caserne/socle';
	import { encreSur } from '../couleurs.ts';
	import { bornesAstreinte, phraseAstreinte, quandRelatif } from './astreinte.ts';

	// La plaque d'astreinte : un à-plat à la couleur de l'équipe (toujours nommée), le texte en noir ou en blanc selon cette couleur.
	// À l'Accueil (`compacte`) : le grand compte à rebours, ou l'heure de la relève, et les gestes dans une bande en dessous.
	// Au Planning : condensée, pour laisser le calendrier en haut. Les mêmes gestes au téléphone et à l'ordinateur.
	// `priseOuverte` : la fenêtre de la relève, calculée sur le serveur.
	let { a, maintenant, compacte = false, priseOuverte = false }: { a: Astreinte; maintenant: string; compacte?: boolean; priseOuverte?: boolean } = $props();

	const p = $derived(phraseAstreinte(a, maintenant));
	const bornes = $derived(bornesAstreinte(a));
	const rubrique = $derived(!a.mienne ? 'Astreinte de la semaine' : a.enCours ? 'Mon astreinte en cours' : 'Ma prochaine astreinte');
	// Le grand texte de l'Accueil : le nombre de jours, l'heure de la relève quand elle est proche, ou « en cours ».
	const forme = $derived(!a.mienne ? 'autre' : a.enCours ? 'encours' : p.jours > 1 ? 'rebours' : 'releve');
	const prise = $derived(compacte && a.mienne && priseOuverte);
	const encre = $derived(encreSur(a.equipe.couleur));
	// Le bouton posé sur la plaque prend l'encre de la plaque en fond : il s'en détache autant que le texte.
	const surBouton = $derived(encreSur(encre));
	const semaine = $derived(`/planning?annee=${a.debut.slice(0, 4)}&vue=semaine&semaine=${a.debut.slice(0, 10)}`);
	const PRISE = 'M9 4h6v3H9z M9 5.5H5V21h14V5.5h-4 M9 14l2 2 4-4';
	const AGENDA = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M12 13v5 M9.5 15.5h5';
	const REMPLACER = 'M7 7h11l-3-3 M17 17H6l3 3';
	const PLANNING = 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4';
	const SUITE = 'M9 6l6 6-6 6';
</script>

{#snippet icone(d: string, taille = 18)}
	<svg aria-hidden="true" width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path {d} /></svg>
{/snippet}

{#snippet dates()}
	<p class="dates"><span class="masque">Du </span>{bornes.debut}<br /><span class="masque"> au </span>{bornes.fin}</p>
{/snippet}

<section class="plaque" class:compacte style:--equipe={a.equipe.couleur} style:--sur-equipe={encre} style:--sur-bouton={surBouton} aria-label={rubrique}>
	<h2 class="masque">{rubrique}</h2>
	<div class="aplat">
		{#if compacte}
			{#if forme === 'rebours'}
				<div class="ligne">
					<p class="rebours"><strong>{p.jours}</strong> <span>jours avant<br />votre astreinte</span></p>
					<div class="droite">
						<p class="equipe">{a.equipe.nom}</p>
						{@render dates()}
					</div>
				</div>
			{:else if forme === 'autre'}
				<div class="ligne">
					<p class="nom">{a.equipe.nom} d’astreinte</p>
					{@render dates()}
				</div>
			{:else}
				<div class="ligne haut">
					<p class="equipe">{a.equipe.nom} · {forme === 'encours' ? 'en cours' : 'relève'}</p>
					<p class="jusqua">jusqu’au {bornes.fin}</p>
				</div>
				<p class="grand">{forme === 'encours' ? 'En cours' : quandRelatif(a.debut, maintenant)}</p>
				{#if p.plage}<p class="plage">{p.plage}</p>{/if}
			{/if}
			{#if prise}
				<a class="prise" href="/engins/prise">{@render icone(PRISE)}Faire la prise de garde{@render icone(SUITE)}</a>
			{/if}
		{:else}
			<div class="textes">
				<p class="titre">{p.titre}</p>
				<p class="plage">{p.quand.charAt(0).toUpperCase() + p.quand.slice(1)}, {a.equipe.nom}</p>
				{#if p.plage}<p class="plage">{p.plage}</p>{/if}
			</div>
			{#if a.mienne}
				<div class="gestes-plaque">
					<a class="prise" href="/remplacements/demander?semaine={a.debut.slice(0, 10)}">{@render icone(REMPLACER)}Me faire remplacer</a>
					<a class="lien" href="/moi/agenda">{@render icone(AGENDA)}Ajouter à mon agenda</a>
				</div>
			{/if}
		{/if}
	</div>
	{#if compacte}
		<div class="gestes">
			{#if a.mienne}
				<a href="/remplacements/demander?semaine={a.debut.slice(0, 10)}">{@render icone(REMPLACER)}Me faire remplacer</a>
				{#if forme === 'rebours'}
					<a href="/moi/agenda">{@render icone(AGENDA)}Ajouter à mon agenda</a>
				{:else}
					<a href={semaine}>{@render icone(PLANNING)}Voir ma semaine</a>
				{/if}
			{:else}
				<a class="planning" href="/planning">Voir le planning{@render icone(SUITE, 16)}</a>
			{/if}
		</div>
	{/if}
</section>

<style>
	.plaque {
		border-radius: var(--rayon-grand);
		overflow: hidden;
		background: var(--surface);
		box-shadow: var(--ombre-carte);
	}
	p {
		margin: 0;
	}
	/* L'à-plat de l'équipe : tout ce qui y est écrit (et le repère du clavier) prend l'encre choisie pour sa couleur. */
	.aplat {
		--focus: var(--sur-equipe);
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 18px;
		background: var(--equipe);
		color: var(--sur-equipe);
	}
	.ligne {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
	}
	.ligne.haut {
		align-items: baseline;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.rebours {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.rebours strong {
		font: 700 5.25rem/0.85 var(--police-titre);
	}
	.rebours span {
		font: 600 1.25rem/1.1 var(--police-titre);
	}
	.droite {
		text-align: right;
	}
	.equipe {
		font: 700 0.9375rem var(--police-titre);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.dates {
		margin-top: 2px;
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.35;
		text-align: right;
	}
	.jusqua {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.nom {
		font: 700 1.625rem/1 var(--police-titre);
		text-transform: uppercase;
	}
	.grand {
		margin-top: -6px;
		font: 700 3.625rem/0.9 var(--police-titre);
		text-transform: uppercase;
		overflow-wrap: anywhere;
	}
	.plage {
		font-size: 0.9375rem;
	}
	/* Le geste du moment, sur la plaque : en encre pleine, comme dans la maquette (anthracite sur une couleur claire). */
	.prise {
		min-height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 0 16px;
		border-radius: var(--rayon-bouton);
		background: var(--sur-equipe);
		color: var(--sur-bouton);
		font: 700 1.3125rem var(--police-titre);
		letter-spacing: 0.02em;
		text-decoration: none;
		--focus: var(--sur-equipe);
	}
	.prise:hover {
		text-decoration: underline;
	}
	/* Les gestes de l'Accueil, dans la bande claire sous la plaque. */
	.gestes {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
	}
	.gestes a {
		min-height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 4px 10px;
		color: var(--encre);
		font-weight: 600;
		text-align: center;
		text-decoration: none;
	}
	.gestes a + a {
		border-left: 1px solid var(--trait-doux);
	}
	.gestes a:hover {
		text-decoration: underline;
	}
	.gestes svg,
	.prise svg {
		flex: none;
	}
	.gestes .planning {
		justify-content: space-between;
		padding: 0 16px;
	}

	/* Au Planning : une ligne, le titre et les gestes à côté dès que la place le permet. */
	.plaque:not(.compacte) .aplat {
		flex-flow: row wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
		padding: 10px 10px 10px 16px;
	}
	.textes {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.titre {
		font: 700 1.25rem/1.15 var(--police-titre);
	}
	.plaque:not(.compacte) .plage {
		font-size: 0.875rem;
	}
	.gestes-plaque {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
	}
	.plaque:not(.compacte) .prise {
		min-height: var(--cible);
		padding: 0 14px;
		font: 600 1rem var(--police);
		letter-spacing: 0;
	}
	.lien {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--sur-equipe);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>

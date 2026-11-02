<script lang="ts">
	import CarteAstreinte from '#lib/planning/CarteAstreinte.svelte';
	import Celebration from '#lib/animations/Celebration.svelte';
	import { momentAnniversaire } from '#lib/animations/celebration.ts';
	import TirerPourActualiser from '#lib/animations/TirerPourActualiser.svelte';
	import GyroAccueil from '#lib/gyro/GyroAccueil.svelte';
	import MeteoAnim from '#lib/meteo/MeteoAnim.svelte';
	import { gyroSelonNiveau, lireAffichageContexte } from '#lib/gyro/niveau.ts';
	import { nombreAFaire } from '#lib/a-faire.ts';
	import ANePasManquer from '#lib/ui/ANePasManquer.svelte';
	import Casquettes from '#lib/ui/Casquettes.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Visage from '#lib/ui/Visage.svelte';
	import { pluriel } from '#lib/pluriel.ts';
	import { DESSINS, type IconeRole as NomIcone } from '#lib/ui/icones-roles.ts';

	let { data, form } = $props();

	// Une seule zone annoncée par page, pour les gestes de « À ne pas manquer ».
	const annonceSucces = $derived(form?.succes ?? '');
	const annonceEchec = $derived(form && !form.succes ? (form.message ?? '') : '');

	const affichage = lireAffichageContexte();
	const ambiance = $derived(data.meteo.meteo?.ambiance ?? null);
	const aFaire = $derived(nombreAFaire(data.aNePasManquer));
	const phrase = $derived(
		[
			// Sans rien à faire, « Tout est à jour » est dit une fois, dans « À ne pas manquer ».
			aFaire === 0 ? '' : `${pluriel(aFaire, 'publication')} ${aFaire > 1 ? 'vous attendent' : 'vous attend'}.`,
			affichage.niveau === 'vivant' ? 'Gyro a fait le plein de café.' : ''
		].join(' ').trim()
	);
	const rangee = $derived(data.casquettes.length >= 2);
	const casquette = $derived(data.casquettes.find((c) => c.id === data.choisie));

	type Lien = { href: string; titre: string; texte: string; icone: NomIcone; dessin?: string };
	const gerer: Lien[] = $derived([
		{ href: '/agents', titre: 'Agents', texte: 'L’équipe et les fiches des agents', icone: 'casque' },
		...(data.peutNominations ? [{ href: '/nominations', titre: 'Nominations', texte: 'Qui tient quel rôle', icone: 'etoile' as const }] : []),
		...(data.peutReglages ? [{ href: '/reglages', titre: 'Réglages', texte: 'Les rôles et les comités', icone: 'outil' as const }] : [])
	]);
	// Hors « Le centre » : de quoi aller vite là où l'on va le plus.
	const raccourcis: Lien[] = $derived([
		{ href: '/planning', titre: 'Planning', texte: 'Astreintes, manœuvres et remplacements', icone: 'cle', dessin: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4' },
		{ href: '/echanges', titre: 'Échanges', texte: 'Les murs du centre et vos messages', icone: 'camion', dessin: DESSINS.echanges },
		{ href: '/agents', titre: 'L’effectif', texte: 'Qui est qui au centre', icone: 'casque' },
		...(data.estPersonne ? [{ href: '/profil', titre: 'Mon profil', texte: 'Téléphone, contact d’urgence', icone: 'livre' as const, dessin: DESSINS.profil }] : [])
	]);

	// « À décider » : les trois premiers, le reste derrière « Voir les autres ».
	const VISIBLES = 3;
</script>

<svelte:head>
	<title>Accueil · Gyro Caserne</title>
</svelte:head>

{#snippet gyro()}<GyroAccueil taille={72} {ambiance} />{/snippet}

{#snippet meteo()}
	{#if data.meteo.meteo}
		<p class="meteo"><span class="masque">{'Temps au centre : '}</span>{data.meteo.meteo.texte}<span aria-hidden="true">{' · '}</span><a href="https://open-meteo.com/" rel="external noopener">Météo : Open-Meteo</a></p>
	{/if}
{/snippet}

{#snippet decider(liste: { texte: string; lien: string }[])}
	<ListeRangees titre="À décider" compte={liste.length}>
		{#each liste.slice(0, VISIBLES) as element, i (i)}
			<li><Rangee href={element.lien} titre={element.texte} alerte /></li>
		{/each}
		{#snippet pied()}
			{#if liste.length > VISIBLES}
				<details class="autres">
					<summary>Voir {liste.length - VISIBLES > 1 ? `les ${liste.length - VISIBLES} autres` : 'l’autre'}</summary>
					<ul role="list">
						{#each liste.slice(VISIBLES) as element, i (i)}
							<li><Rangee href={element.lien} titre={element.texte} alerte /></li>
						{/each}
					</ul>
				</details>
			{/if}
		{/snippet}
	</ListeRangees>
{/snippet}

{#snippet liens(titre: string, liste: Lien[])}
	<ListeRangees {titre}>
		{#each liste as l (l.href)}
			<li><Rangee href={l.href} titre={l.titre} sous={l.texte} icone={l.icone} dessin={l.dessin} /></li>
		{/each}
	</ListeRangees>
{/snippet}

<div class="page">
	<TirerPourActualiser />
	{#if data.meteo.vigilance}
		<section class="vigilance" class:rouge={data.meteo.vigilance.niveau === 4} aria-label="Vigilance météo">
			<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3z M12 10v4 M12 17h.01" /></svg>
			<div>
				{#each data.meteo.vigilance.lignes as ligne (ligne)}<p class="ligne">{ligne}</p>{/each}
				<a href="https://vigilance.meteofrance.fr/" rel="external noopener">Consignes sur vigilance.meteofrance.fr</a>
			</div>
		</section>
	{/if}
	<div class="ciel">
		{#if ambiance && affichage.niveau !== 'sobre'}<MeteoAnim {ambiance} />{/if}
		<div class="devant">
			<EnTetePage titre={data.prenom ? `Bonjour ${data.prenom}` : 'Bonjour'} {phrase} complement={data.meteo.meteo ? meteo : undefined} tete={gyroSelonNiveau(affichage.niveau).visible ? gyro : undefined} />
		</div>
	</div>

	{#if rangee}<Casquettes casquettes={data.casquettes} choisie={data.choisie} />{/if}

	{#if data.astreinte}<CarteAstreinte a={data.astreinte} maintenant={data.maintenant} compacte />{/if}

	<div class="masque" role="status">{annonceSucces}</div>
	<div class="masque" role="alert">{annonceEchec}</div>

	<div class="colonnes">
		<div class="colonne">
			<ANePasManquer a={data.aNePasManquer} casquette={data.choisie} {form} />
		</div>

		<div class="colonne">
			{#if data.contenu.type === 'centre'}
				{#if data.contenu.aDecider.length > 0}
					{@render decider(data.contenu.aDecider)}
				{:else}
					<ListeRangees titre="À décider">
						<li><Rangee icone="croix" dessin={DESSINS.ok} titre="Rien à décider pour le moment." sous="Les équipes ont leur chef et chaque rôle son titulaire." /></li>
					</ListeRangees>
				{/if}
				{@render liens('Gérer', gerer)}
			{:else}
				{#if (data.contenu.type === 'role' || data.contenu.type === 'comite' || data.contenu.type === 'equipe') && data.contenu.aDecider.length > 0}
					{@render decider(data.contenu.aDecider)}
				{/if}
				{#if data.contenu.type === 'equipe' && data.contenu.aDecider.length === 0}
					<ListeRangees titre="À décider">
						<li><Rangee icone="croix" dessin={DESSINS.ok} titre="Aucun remplacement à valider." sous="Quand une aptitude contrôlée manque à un remplaçant de votre équipe, c’est ici." /></li>
					</ListeRangees>
				{/if}
				{#if data.contenu.type === 'role'}
					<ListeRangees titre="Ce que ce rôle permet">
						{#each data.contenu.permet as permis (permis)}
							<li><Rangee titre={permis} icone={casquette?.icone ?? 'etoile'} /></li>
						{:else}
							<li><Rangee titre="Ce rôle n’ajoute rien à ce que fait tout agent." icone={casquette?.icone ?? 'etoile'} /></li>
						{/each}
					</ListeRangees>
				{:else if data.contenu.type === 'comite'}
					<ListeRangees titre="Membres" compte={data.contenu.membres.length}>
						{#each data.contenu.membres as membre (membre.personneId)}
							<li>
								<Rangee titre="{membre.prenom} {membre.nom}" sous={membre.role}>
									{#snippet tete()}<Visage prenom={membre.prenom} nom={membre.nom} couleur={null} taille={40} />{/snippet}
								</Rangee>
							</li>
						{:else}
							<li><Rangee titre="Aucun membre pour le moment." icone="groupe" /></li>
						{/each}
					</ListeRangees>
				{/if}
				{@render liens('Raccourcis', raccourcis)}
			{/if}
		</div>
	</div>
</div>
<Celebration moment={momentAnniversaire(data.anniversaire === true, data.aujourdhui)} qui={data.qui} />

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	/* L'ambiance passe derrière l'en-tête, déborde un peu sur les côtés, sans gêner la lecture. */
	.ciel {
		position: relative;
		margin: -12px -16px 0;
		padding: 12px 16px 0;
		border-radius: var(--rayon-grand);
		overflow: hidden;
	}
	.devant {
		position: relative;
		z-index: 1;
	}
	.meteo {
		margin: 4px 0 0;
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.meteo a {
		color: var(--doux);
		font-size: 0.8125rem;
		white-space: nowrap;
	}
	.vigilance {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 12px 16px;
		border: 1px solid var(--statut-alerte-trait);
		border-left-width: 6px;
		border-radius: var(--rayon-grand);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
	}
	.vigilance.rouge {
		border-color: var(--statut-danger-trait);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
	}
	.vigilance svg {
		flex: none;
		margin-top: 2px;
	}
	.vigilance .ligne {
		margin: 0;
		font-weight: 700;
	}
	.vigilance a {
		display: inline-block;
		margin-top: 4px;
		color: inherit;
	}
	.colonnes,
	.colonne {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.autres summary {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 4px;
		color: var(--encre);
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	.autres summary::-webkit-details-marker {
		display: none;
	}
	.autres summary::before {
		content: '';
		width: 8px;
		height: 8px;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(-45deg);
	}
	.autres[open] summary::before {
		transform: rotate(45deg);
	}
	.autres[open] summary {
		margin-bottom: 10px;
	}
	.autres ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
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

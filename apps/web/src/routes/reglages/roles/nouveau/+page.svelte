<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { ADMINISTRATION, DOMAINES, niveauxDe } from '#lib/paquets.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import ChoixIcone from '../../ChoixIcone.svelte';
	import { NATURES, optionsAttributeur, PORTEES } from '../../roles.ts';

	let { data, form } = $props();

	type Modele = (typeof data.modeles)[number];
	// Ce que donne le modèle, dit par domaine.
	function donne(m: Modele): string {
		const niveaux = niveauxDe(m.droits);
		const domaines = DOMAINES.filter((d) => niveaux[d.id] !== 0).map((d) => `${d.nom} : ${d.niveaux[niveaux[d.id] as number]?.libelle ?? 'Sur mesure'}`);
		const pouvoir = m.droits.some((d) => ADMINISTRATION.some((a) => a.droit === d)) ? ['Administration de l’appli'] : [];
		return [...domaines, ...pouvoir].join(', ') || 'Aucun droit en plus de ceux de tout agent';
	}

	const choisi = $derived(data.choisi);
	const erreurs = $derived<Record<string, string>>(form?.erreurs ?? {});
	const saisie = (champ: 'nom' | 'nature' | 'portee' | 'attributeur', defaut: string) => form?.valeurs?.[champ] ?? defaut;
</script>

<svelte:head>
	<title>Nouveau rôle · Réglages · Gyro Caserne</title>
</svelte:head>

<EnTetePage titre="Nouveau rôle" />

{#if !choisi}
	<p class="intro">À partir de quel modèle ? Le rôle en reprend les droits ; vous pourrez les ajuster ensuite.</p>
	<ul class="modeles">
		{#each data.modeles as m (m.id)}
			<li>
				{#if m.reserve}
					<div class="carte reserve">
						<IconeRole icone={m.icone} taille={44} />
						<span class="textes">
							<span class="nom">{m.nom}</span>
							<span class="donne">{donne(m)}</span>
							<span class="donne">Réservé au chef de centre, à son adjoint et au super administrateur.</span>
						</span>
					</div>
				{:else}
					<a class="carte" href="?modele={m.id}">
						<IconeRole icone={m.icone} taille={44} />
						<span class="textes">
							<span class="nom">{m.nom}</span>
							<span class="donne">{donne(m)}</span>
						</span>
						<span class="chevron" aria-hidden="true">›</span>
					</a>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="intro">Modèle : {choisi.nom}. {donne(choisi)}. <a href="/reglages/roles/nouveau">Changer de modèle</a></p>
	<div role="alert">
		{#if form?.message || form?.erreurs}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>
	<form method="POST" class="formulaire">
		<input type="hidden" name="modele" value={choisi.id} />
		<Champ id="nouveau-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={saisie('nom', choisi.id === 'vierge' ? '' : choisi.nom)} erreur={erreurs.nom} />
		<Choix id="nouveau-nature" name="nature" libelle="Nature" valeur={saisie('nature', choisi.nature)} erreur={erreurs.nature} options={NATURES} />
		<Choix id="nouveau-portee" name="portee" libelle="Portée" valeur={saisie('portee', choisi.portee)} erreur={erreurs.portee} options={PORTEES} />
		<Choix
			id="nouveau-attributeur"
			name="attributeur"
			libelle="Qui attribue"
			valeur={saisie('attributeur', choisi.portee === 'comite' ? 'comite_vise' : 'chef_centre')}
			erreur={erreurs.attributeur}
			options={optionsAttributeur(data.comitesChoix)}
		/>
		<ChoixIcone valeur={(form?.valeurs?.icone as typeof choisi.icone | undefined) ?? choisi.icone} erreur={erreurs.icone} />
		<Bouton type="submit">Créer le rôle</Bouton>
	</form>
{/if}

<style>
	p {
		margin: 0;
	}
	.intro {
		color: var(--doux);
	}
	.modeles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--espace-12);
	}
	.carte {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: 72px;
		padding: var(--espace-12) var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		color: var(--encre);
		text-decoration: none;
	}
	.reserve {
		border-style: dashed;
		border-color: var(--statut-neutre-trait);
	}
	.textes {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nom {
		font-weight: 700;
	}
	.donne {
		font-size: var(--texte-14);
		color: var(--doux);
	}
	.chevron {
		font-size: var(--texte-20);
		color: var(--doux);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-lecture);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	@media (min-width: 1024px) {
		.modeles {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>

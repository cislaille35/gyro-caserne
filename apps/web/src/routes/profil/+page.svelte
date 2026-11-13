<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Vide from '#lib/ui/Vide.svelte';

	let { data, form } = $props();

	const profil = $derived(data.profil);
	const valeurs = $derived(form?.valeurs ?? {});
	const erreurs = $derived(form?.erreurs ?? {});
	const texte = (cle: string, actuel: string | null) => valeurs[cle] ?? actuel ?? '';
</script>

<svelte:head>
	<title>Mon profil · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Mon profil" phrase={profil === null ? undefined : 'Ce que le centre voit de vous, et qui prévenir.'} retour={{ href: '/moi', libelle: 'Moi' }} />

	<div role="status">
		{#if form?.succes}<p class="succes">{form.message}</p>{/if}
	</div>
	<div role="alert">
		{#if form && !form.succes && (form.message || form.erreurs)}<p class="echec">{form.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>

	{#if profil === null}
		<Vide
			titre="Le super administrateur n’a pas de fiche."
			texte="Il règle le centre sans en être un agent : ni téléphone ni contact d’urgence à renseigner ici."
			action={{ href: '/affichage', libelle: 'Régler l’affichage' }}
		/>
	{:else}
		<Carte titre="Mes informations">
			<form method="POST">
				<Champ id="surnom" name="surnom" libelle="Surnom" maxlength={60} valeur={texte('surnom', profil.surnom)} erreur={erreurs.surnom} />
				<Champ id="telephone" name="telephone" type="tel" autocomplete="tel" libelle="Téléphone" maxlength={20} valeur={texte('telephone', profil.telephone)} erreur={erreurs.telephone} />
				<label>
					<input type="checkbox" name="telephoneVisible" checked={profil.telephoneVisible} />
					Montrer mon téléphone au centre
				</label>
				<Champ
					id="contact-urgence"
					name="contactUrgence"
					libelle="Contact d'urgence"
					maxlength={200}
					aide="Nom et numéro de la personne à prévenir."
					valeur={texte('contactUrgence', profil.contactUrgence)}
					erreur={erreurs.contactUrgence}
				/>
				<Champ
					id="naissance"
					name="naissance"
					type="date"
					libelle="Date de naissance"
					aide="Vue du chef de centre et de son adjoint seulement. Votre âge n’est jamais montré."
					valeur={texte('naissance', profil.naissance)}
					erreur={erreurs.naissance}
				/>
				<label>
					<input type="checkbox" name="anniversaireVisible" checked={profil.anniversaireVisible} />
					Afficher mon anniversaire
				</label>
				{#if data.messagerie}
					<div class="case">
						<input type="hidden" name="avecCoches" value="1" />
						<label>
							<input type="checkbox" name="cochesLecture" checked={profil.cochesLecture} aria-describedby="aide-coches" />
							Montrer quand j’ai lu les messages
						</label>
						<p class="aide" id="aide-coches">Vos collègues voient ✓✓ quand vous avez lu. Sans cette case, vous ne voyez plus non plus celles des autres.</p>
					</div>
				{/if}
				<Bouton type="submit">Enregistrer</Bouton>
			</form>
		</Carte>
	{/if}
</div>

<style>
	.page,
	form {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.page {
		max-width: var(--largeur-lecture);
		margin-inline: auto;
	}
	/* Zones d'annonce vides : présentes pour les lecteurs d'écran, sans creuser d'espace. */
	.page > [role]:empty {
		position: absolute;
	}
	p {
		margin: 0;
	}
	form :global(button) {
		align-self: flex-start;
	}
	.succes,
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid var(--statut-ok-trait);
		border-radius: var(--rayon-grand);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		font-weight: 600;
	}
	.succes::before {
		content: '✓ ';
		content: '✓ ' / '';
	}
	.echec {
		border-color: var(--statut-danger-trait);
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
	}
	label {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
		font-weight: 600;
	}
	.case {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.aide {
		margin-left: calc(1.5rem + var(--espace-12));
		color: var(--doux);
		font-size: var(--texte-14);
	}
</style>

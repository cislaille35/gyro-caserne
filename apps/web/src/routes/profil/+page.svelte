<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';

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
	<h1>Mon profil</h1>

	<div role="status">
		{#if form?.succes}<p class="succes">{form.message}</p>{/if}
	</div>
	<div role="alert">
		{#if form && !form.succes && (form.message || form.erreurs)}<p class="echec">{form.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>

	{#if profil === null}
		<p>Le super administrateur n'a pas de fiche.</p>
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
		gap: 16px;
	}
	h1,
	p {
		margin: 0;
	}
	form :global(button) {
		align-self: flex-start;
	}
	.succes,
	.echec {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--trait);
		font-weight: 600;
	}
	.echec {
		border-color: var(--accent);
	}
	label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--cible);
		font-weight: 600;
	}
	.case {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.aide {
		margin-left: calc(1.5rem + 12px);
		color: var(--doux);
		font-size: 0.875rem;
	}
	input[type='checkbox'] {
		width: 1.5rem;
		height: 1.5rem;
		accent-color: var(--accent);
	}
</style>

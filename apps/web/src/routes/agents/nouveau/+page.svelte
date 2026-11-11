<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { LIBELLES_STATUT } from '#lib/ui/statut.ts';

	let { data, form } = $props();

	const valeurs = $derived(form?.valeurs ?? {});
	const erreurs = $derived(form?.erreurs ?? {});
</script>

<svelte:head>
	<title>Ajouter un agent · Agents · Gyro Caserne</title>
</svelte:head>

<div class="nouveau">
	<EnTetePage titre="Ajouter un agent" phrase="Sa fiche pourra être complétée ensuite." />
	<div role="alert">
		{#if form?.message || form?.erreurs}<p class="echec">{form.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>

	<form method="POST">
		<Carte titre="Identité et contact">
			<div class="champs">
				<Champ id="prenom" name="prenom" libelle="Prénom" requis maxlength={60} valeur={valeurs.prenom ?? ''} erreur={erreurs.prenom} />
				<Champ id="nom" name="nom" libelle="Nom" requis maxlength={60} valeur={valeurs.nom ?? ''} erreur={erreurs.nom} />
				<Champ id="email" name="email" type="email" libelle="E-mail" aide="Sert à la connexion." requis maxlength={254} valeur={valeurs.email ?? ''} erreur={erreurs.email} />
				<Champ id="telephone" name="telephone" type="tel" libelle="Téléphone" maxlength={20} valeur={valeurs.telephone ?? ''} erreur={erreurs.telephone} />
				<Champ id="naissance" name="naissance" type="date" libelle="Date de naissance" valeur={valeurs.naissance ?? ''} erreur={erreurs.naissance} />
			</div>
		</Carte>

		<Carte titre="Parcours">
			<div class="champs">
				<Choix
					id="grade"
					name="gradeId"
					libelle="Grade"
					valeur={valeurs.gradeId ?? ''}
					erreur={erreurs.gradeId}
					options={[{ valeur: '', libelle: 'Aucun grade' }, ...data.grades.map((g) => ({ valeur: String(g.id), libelle: g.libelle }))]}
				/>
				<Champ id="date-grade" name="dateGrade" type="date" libelle="Date de nomination" valeur={valeurs.dateGrade ?? ''} erreur={erreurs.dateGrade} />
				<Choix
					id="profil"
					name="profilId"
					libelle="Profil"
					requis
					valeur={valeurs.profilId ?? data.profilParDefaut}
					erreur={erreurs.profilId}
					options={data.profils.map((p) => ({ valeur: String(p.id), libelle: p.nom }))}
				/>
				<Choix
					id="statut"
					name="statut"
					libelle="Statut"
					valeur={valeurs.statut ?? 'operationnel'}
					erreur={erreurs.statut}
					options={data.statuts.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] }))}
				/>
				<Champ id="entree-centre" name="entreeCentre" type="date" libelle="Entrée au centre" valeur={valeurs.entreeCentre ?? ''} erreur={erreurs.entreeCentre} />
				<Champ id="engagement-spv" name="engagementSpv" type="date" libelle="Engagement SPV" valeur={valeurs.engagementSpv ?? ''} erreur={erreurs.engagementSpv} />
			</div>
		</Carte>

		<Carte titre="Équipe">
			<Choix
				id="equipe"
				name="equipeId"
				libelle="Équipe"
				aide="À partir d'aujourd'hui."
				valeur={valeurs.equipeId ?? ''}
				erreur={erreurs.equipeId}
				options={[{ valeur: '', libelle: 'Aucune équipe' }, ...data.equipes.map((e) => ({ valeur: String(e.id), libelle: e.nom }))]}
			/>
		</Carte>

		<Bouton type="submit">Ajouter l'agent</Bouton>
	</form>
</div>

<style>
	.nouveau,
	form,
	.champs {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	form > :global(button) {
		align-self: flex-start;
	}
	p {
		margin: 0;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>

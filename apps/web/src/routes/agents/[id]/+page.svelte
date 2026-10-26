<script lang="ts">
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import PastilleEquipe from '#lib/ui/PastilleEquipe.svelte';
	import Statut from '#lib/ui/Statut.svelte';
	import { LIBELLES_STATUT } from '#lib/ui/statut.ts';

	let { data, form } = $props();

	const fiche = $derived(data.fiche);
	const valeurs = $derived(form?.valeurs ?? {});
	const erreurs = $derived(form?.erreurs ?? {});
	const texte = (cle: string, actuel: string | null) => valeurs[cle] ?? actuel ?? '';
	const date = (jour: string | null) => (jour ? jour.split('-').reverse().join('/') : '—');

	let statutChoisi = $derived(form?.valeurs?.statut ?? fiche.statut);
</script>

<svelte:head>
	<title>{fiche.prenom} {fiche.nom} · Agents · Gyro Caserne</title>
</svelte:head>

{#key fiche.id}
	<div class="fiche">
		<div class="titre">
			<h1>{fiche.prenom} {fiche.nom}</h1>
			<Statut statut={fiche.statut} />
		</div>

		<div role="status">
			{#if form?.succes}<p class="succes">{form.message}</p>{/if}
		</div>
		<div role="alert">
			{#if form && !form.succes && form.message}<p class="echec">{form.message}</p>{/if}
		</div>

		<Carte titre="Identité et contact">
			{#if data.raison}
				<p class="raison">{data.raison}</p>
				<dl>
					<dt>E-mail</dt><dd>{fiche.email}</dd>
					<dt>Téléphone</dt><dd>{fiche.telephone ?? '—'}</dd>
					<dt>Date de naissance</dt><dd>{date(fiche.naissance)}</dd>
				</dl>
			{:else}
				<form method="POST" action="?/fiche">
					<Champ id="prenom" name="prenom" libelle="Prénom" requis valeur={texte('prenom', fiche.prenom)} erreur={erreurs.prenom} />
					<Champ id="nom" name="nom" libelle="Nom" requis valeur={texte('nom', fiche.nom)} erreur={erreurs.nom} />
					<Champ id="email" name="email" type="email" libelle="E-mail" aide="Sert à la connexion." requis valeur={texte('email', fiche.email)} erreur={erreurs.email} />
					<Champ id="telephone" name="telephone" type="tel" libelle="Téléphone" valeur={texte('telephone', fiche.telephone)} erreur={erreurs.telephone} />
					<Champ id="naissance" name="naissance" type="date" libelle="Date de naissance" valeur={texte('naissance', fiche.naissance)} erreur={erreurs.naissance} />
					<Bouton type="submit">Enregistrer</Bouton>
				</form>
			{/if}
			<dl>
				<dt>Surnom</dt><dd>{fiche.surnom ?? '—'}</dd>
				<dt>Contact d'urgence</dt><dd>{fiche.contactUrgence ?? '—'}</dd>
			</dl>
			<p class="note">Le surnom et le contact d'urgence sont saisis par l'agent lui-même.</p>
		</Carte>

		<Carte titre="Parcours">
			{#if data.raison}
				<p class="raison">{data.raison}</p>
				<dl>
					<dt>Grade</dt><dd>{fiche.grade?.libelle ?? '—'}</dd>
					<dt>Date de nomination</dt><dd>{date(fiche.dateGrade)}</dd>
					<dt>Profil</dt><dd>{fiche.profil?.nom ?? '—'}</dd>
					<dt>Entrée au centre</dt><dd>{date(fiche.entreeCentre)}</dd>
					<dt>Engagement SPV</dt><dd>{date(fiche.engagementSpv)}</dd>
				</dl>
			{:else}
				<form method="POST" action="?/fiche">
					<Choix
						id="grade"
						name="gradeId"
						libelle="Grade"
						valeur={texte('gradeId', fiche.grade ? String(fiche.grade.id) : '')}
						erreur={erreurs.gradeId}
						options={[{ valeur: '', libelle: 'Aucun grade' }, ...data.grades.map((g) => ({ valeur: String(g.id), libelle: g.libelle }))]}
					/>
					<Champ id="date-grade" name="dateGrade" type="date" libelle="Date de nomination" valeur={texte('dateGrade', fiche.dateGrade)} erreur={erreurs.dateGrade} />
					<Choix
						id="profil"
						name="profilId"
						libelle="Profil"
						requis
						valeur={texte('profilId', fiche.profil ? String(fiche.profil.id) : '')}
						erreur={erreurs.profilId}
						options={[...(fiche.profil ? [] : [{ valeur: '', libelle: 'À choisir' }]), ...data.profils.map((p) => ({ valeur: String(p.id), libelle: p.nom }))]}
					/>
					<Champ id="entree-centre" name="entreeCentre" type="date" libelle="Entrée au centre" valeur={texte('entreeCentre', fiche.entreeCentre)} erreur={erreurs.entreeCentre} />
					<Champ id="engagement-spv" name="engagementSpv" type="date" libelle="Engagement SPV" valeur={texte('engagementSpv', fiche.engagementSpv)} erreur={erreurs.engagementSpv} />
					<Bouton type="submit">Enregistrer</Bouton>
				</form>
			{/if}
		</Carte>

		<Carte titre="Équipe et statut">
			{#if data.raison}
				<p class="raison">{data.raison}</p>
				<dl>
					<dt>Équipe</dt><dd>{#if fiche.equipe}<PastilleEquipe nom={fiche.equipe.nom} couleur={fiche.equipe.couleur} />{:else}Aucune équipe{/if}</dd>
					<dt>Statut</dt><dd>{LIBELLES_STATUT[fiche.statut]}</dd>
				</dl>
			{:else}
				<form method="POST" action="?/equipe">
					<Choix
						id="equipe"
						name="equipe"
						libelle="Équipe"
						aide="Le changement prend effet aujourd'hui."
						valeur={fiche.equipe ? String(fiche.equipe.id) : 'aucune'}
						erreur={erreurs.equipe}
						options={[{ valeur: 'aucune', libelle: 'Aucune équipe' }, ...data.equipes.map((e) => ({ valeur: String(e.id), libelle: e.nom }))]}
					/>
					<Bouton type="submit">Enregistrer</Bouton>
				</form>
				<form method="POST" action="?/statut">
					<Choix
						id="statut"
						name="statut"
						libelle="Statut"
						bind:valeur={statutChoisi}
						erreur={erreurs.statut}
						options={data.statuts.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] }))}
					/>
					{#if statutChoisi === 'parti'}
						<div class="depart">
							<p id="depart-avertissement"><strong>Attention :</strong> Sa date de naissance et son contact d'urgence seront effacés.</p>
							<label>
								<input
									type="checkbox"
									name="confirmation"
									value="oui"
									aria-invalid={erreurs.confirmation ? 'true' : undefined}
									aria-describedby={erreurs.confirmation ? 'depart-avertissement confirmation-erreur' : 'depart-avertissement'}
								/>
								Je confirme
							</label>
							{#if erreurs.confirmation}<p id="confirmation-erreur" class="erreur">{erreurs.confirmation}</p>{/if}
						</div>
					{/if}
					<Bouton type="submit">Enregistrer</Bouton>
				</form>
			{/if}
		</Carte>
	</div>
{/key}

<style>
	.fiche,
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	form + form {
		margin-top: 24px;
		padding-top: 24px;
		border-top: 1px solid var(--trait);
	}
	form :global(button) {
		align-self: flex-start;
	}
	.titre {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	h1 {
		margin: 0;
	}
	p {
		margin: 0;
	}
	.succes,
	.echec,
	.raison {
		padding: 12px 16px;
		border-radius: var(--rayon-petit);
		border: 2px solid var(--trait);
		font-weight: 600;
	}
	.echec {
		border-color: var(--accent);
	}
	.raison {
		margin-bottom: 12px;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 16px;
		margin: 16px 0 0;
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	.note {
		margin-top: 8px;
		color: var(--doux);
		font-size: 0.9375rem;
	}
	.depart {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 16px;
		border: 2px solid var(--accent);
		border-radius: var(--rayon-petit);
	}
	label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--cible);
		font-weight: 600;
	}
	input[type='checkbox'] {
		width: 1.5rem;
		height: 1.5rem;
		accent-color: var(--accent);
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
	}
</style>

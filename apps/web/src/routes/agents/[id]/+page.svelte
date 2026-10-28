<script lang="ts">
	import { enhance } from '$app/forms';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Initiales from '#lib/ui/Initiales.svelte';
	import PastilleEquipe from '#lib/ui/PastilleEquipe.svelte';
	import Statut from '#lib/ui/Statut.svelte';
	import { LIBELLES_STATUT } from '#lib/ui/statut.ts';

	let { data, form } = $props();

	const fiche = $derived(data.fiche);
	// Les messages d'un formulaire à cible (rôles) restent à côté de lui.
	const generale = $derived(form && !form.cible ? form : null);
	const valeurs = $derived(generale?.valeurs ?? {});
	const erreurs = $derived(generale?.erreurs ?? {});
	const texte = (cle: string, actuel: string | null) => valeurs[cle] ?? actuel ?? '';
	const date = (jour: string | null) => (jour ? jour.split('-').reverse().join('/') : '—');

	const aujourdhuiIso = $derived(data.aujourdhui);
	const intitule = (l: { responsabilite: { nom: string }; perimetre: { nom: string | null } }) => (l.perimetre.nom ? `${l.responsabilite.nom} — ${l.perimetre.nom}` : l.responsabilite.nom);
	const periode = (l: { debut: string; fin: string | null }) => (l.fin ? `du ${date(l.debut)} au ${date(l.fin)}` : `depuis le ${date(l.debut)}`);
	const concerne = (cible: string) => form?.cible === cible;
	// « Terminer » ou « Changer la date de fin » peuvent sortir le rôle de sa liste : le succès s'annonce dans la carte.
	const annonceRole = $derived(form?.succes && /^(terminer|finir)-/.test(String(form.cible ?? '')) ? form.message : null);

	// Une seule soumission à la fois par formulaire : le bouton se désactive pendant l'envoi.
	let envoi = $state<string | null>(null);
	const surEnvoi = (cible: string) => () => {
		envoi = cible;
		return async ({ update }: { update: () => Promise<void> }) => {
			try {
				await update();
			} finally {
				envoi = null;
			}
		};
	};

	const nominations = $derived(data.peutAttribuer);
	const saisie = (cle: string, defaut: string) => (concerne('attribuer') ? (form?.valeurs?.[cle] ?? defaut) : defaut);
	let responsabiliteChoisie = $derived(saisie('responsabiliteId', nominations[0] ? String(nominations[0].responsabiliteId) : ''));
	const choix = $derived(nominations.find((r) => String(r.responsabiliteId) === responsabiliteChoisie) ?? nominations[0]);
	// La saisie du périmètre ne vaut que pour la responsabilité qui l'a produite.
	const perimetreInitial = $derived.by(() => {
		const envoye = saisie('perimetre', '');
		const valide = choix?.perimetres.some((p) => String(p.id) === envoye);
		return valide ? envoye : String(choix?.perimetres[0]?.id ?? '');
	});
	const erreursNomination = $derived(concerne('attribuer') ? (form?.erreurs ?? {}) : {});

	// « Parti » se déclare dans son propre bloc ; un agent parti le garde dans la liste, pour être réintégré.
	const statuts = $derived(data.statuts.filter((s) => s !== 'parti' || fiche.statut === 'parti'));
	const statutAffiche = $derived(valeurs.statut && statuts.some((s) => s === valeurs.statut) ? valeurs.statut : fiche.statut);

	// Résumés des blocs fermés.
	const enCours = $derived(data.attributions.enCours);
	const sousTitre = $derived([fiche.grade?.libelle, fiche.equipe?.nom].filter(Boolean).join(' · '));
	const resumes = $derived({
		identite: [fiche.email, fiche.telephone].filter(Boolean).join(' · '),
		parcours: [fiche.grade?.libelle ?? 'Aucun grade', fiche.entreeCentre && `au centre depuis ${fiche.entreeCentre.slice(0, 4)}`].filter(Boolean).join(' · '),
		equipe: `${fiche.equipe?.nom ?? 'Aucune équipe'} · ${LIBELLES_STATUT[fiche.statut]}`,
		roles: [enCours.length ? enCours.map(intitule).join(' · ') : 'Aucun rôle en cours', data.attributions.aVenir.length && `${data.attributions.aVenir.length} à venir`].filter(Boolean).join(' · '),
		depart: fiche.statut === 'parti' ? 'A quitté le centre' : 'Fin des rôles, données personnelles effacées'
	});

	// Le bloc concerné par le dernier envoi s'ouvre seul : on y voit l'erreur ou le message.
	const IDENTITE = ['prenom', 'nom', 'email', 'telephone', 'naissance'];
	const PARCOURS = ['gradeId', 'dateGrade', 'profilId', 'entreeCentre', 'engagementSpv'];
	const blocOuvert = $derived.by(() => {
		if (form?.cible) return 'roles';
		if (!generale || generale.succes) return null;
		// Les champs en erreur, ou à défaut ceux envoyés, désignent le formulaire.
		const champs = Object.keys({ ...valeurs, ...erreurs });
		if (champs.includes('confirmation') || valeurs.statut === 'parti') return 'depart';
		if (champs.some((c) => IDENTITE.includes(c))) return 'identite';
		if (champs.some((c) => PARCOURS.includes(c))) return 'parcours';
		if (champs.includes('equipeId') || champs.includes('statut')) return 'equipe';
		return null;
	});
	const chiffres = (tel: string) => tel.replace(/[^\d+]/g, '');
</script>

<svelte:head>
	<title>{fiche.prenom} {fiche.nom} · Agents · Gyro Caserne</title>
	<!-- Sans JavaScript, les blocs ne se replient pas : tout reste visible et les formulaires s'envoient. -->
	<noscript><style>.groupe > [hidden] { display: block !important; } .groupe .chevron { display: none; }</style></noscript>
</svelte:head>

{#snippet liste(titre: string, lignes: typeof data.attributions.enCours)}
	<h3>{titre}</h3>
	<ul class="roles">
		{#each lignes as l (l.id)}
			{@const cible = `terminer-${l.id}`}
			<li>
				<div>
					<strong>{intitule(l)}</strong>
					<span class="note">{periode(l)} · saisi par {l.saisiePar}</span>
					{#if concerne(cible) && form?.erreurs?.confirmation}
						<p id="{cible}-erreur" class="echec" role="alert">{form.erreurs.confirmation}</p>
					{:else if (concerne(cible) || concerne(`finir-${l.id}`)) && form?.message && !form.succes}
						<p class="echec" role="alert">{form.message}</p>
					{/if}
				</div>
				{#if l.peutTerminer}
					{@const finir = `finir-${l.id}`}
					<form method="POST" action="?/finir" class="finir" use:enhance={surEnvoi(finir)}>
						<input type="hidden" name="attributionId" value={l.id} />
						<Champ
							id="nouvelle-fin-{l.id}"
							name="fin"
							type="date"
							libelle={`Nouvelle date de fin : ${intitule(l)}`}
							valeur={concerne(finir) ? (form?.valeurs?.fin ?? l.fin ?? '') : (l.fin ?? '')}
							erreur={concerne(finir) ? form?.erreurs?.fin : undefined}
						/>
						<Bouton type="submit" variante="secondaire" desactive={envoi === finir}>Changer la date de fin</Bouton>
					</form>
					<form method="POST" action="?/terminer" class="terminer" use:enhance={surEnvoi(cible)}>
						<input type="hidden" name="attributionId" value={l.id} />
						<label>
							<input
								type="checkbox"
								name="confirmation"
								value="oui"
								aria-label={`Je confirme : terminer ${intitule(l)}`}
								aria-invalid={concerne(cible) && form?.erreurs?.confirmation ? 'true' : undefined}
								aria-describedby={concerne(cible) && form?.erreurs?.confirmation ? `${cible}-erreur` : undefined}
							/>
							Je confirme
						</label>
						<Bouton type="submit" variante="secondaire" desactive={envoi === cible}>Terminer</Bouton>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#key fiche.id}
	<div class="fiche">
		<header class="entete">
			<div class="qui">
				<Initiales prenom={fiche.prenom} nom={fiche.nom} taille={64} />
				<div>
					<h1>{fiche.prenom} {fiche.nom}</h1>
					{#if sousTitre}<p class="doux">{sousTitre}</p>{/if}
				</div>
			</div>
			<ul class="etiquettes" aria-label="Statut et rôles en cours">
				<li><Statut statut={fiche.statut} /></li>
				{#each enCours as l (l.id)}
					<li class="role"><IconeRole icone={l.responsabilite.icone} taille={24} />{intitule(l)}</li>
				{/each}
			</ul>
			<div class="contact">
				{#if fiche.telephone}<a href="tel:{chiffres(fiche.telephone)}">Appeler</a>{/if}
				<a href="mailto:{fiche.email}">Écrire</a>
			</div>
		</header>

		<div role="status">
			{#if generale?.succes}<p class="succes">{generale.message}</p>{/if}
		</div>
		<div role="alert">
			{#if generale && !generale.succes && (generale.message || generale.erreurs)}<p class="echec">{generale.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
		</div>

		<Groupe titre="Identité et contact" resume={resumes.identite} ouvert={blocOuvert === 'identite'}>
			<div class="bloc">
				{#if data.raison}
					<p class="raison">{data.raison}</p>
					<dl>
						<dt>E-mail</dt><dd>{fiche.email}</dd>
						<dt>Téléphone</dt><dd>{fiche.telephone ?? '—'}</dd>
						<dt>Date de naissance</dt><dd>{date(fiche.naissance)}</dd>
					</dl>
				{:else}
					<form method="POST" action="?/fiche">
						<Champ id="prenom" name="prenom" libelle="Prénom" requis maxlength={60} valeur={texte('prenom', fiche.prenom)} erreur={erreurs.prenom} />
						<Champ id="nom" name="nom" libelle="Nom" requis maxlength={60} valeur={texte('nom', fiche.nom)} erreur={erreurs.nom} />
						<Champ id="email" name="email" type="email" libelle="E-mail" aide="Sert à la connexion." requis maxlength={254} valeur={texte('email', fiche.email)} erreur={erreurs.email} />
						<Champ id="telephone" name="telephone" type="tel" libelle="Téléphone" maxlength={20} valeur={texte('telephone', fiche.telephone)} erreur={erreurs.telephone} />
						<Champ id="naissance" name="naissance" type="date" libelle="Date de naissance" valeur={texte('naissance', fiche.naissance)} erreur={erreurs.naissance} />
						<Bouton type="submit">Enregistrer</Bouton>
					</form>
				{/if}
				<dl>
					<dt>Surnom</dt><dd>{fiche.surnom ?? '—'}</dd>
					<dt>Contact d'urgence</dt><dd>{fiche.contactUrgence ?? '—'}</dd>
				</dl>
				<p class="note">Le surnom et le contact d'urgence sont saisis par l'agent lui-même.</p>
			</div>
		</Groupe>

		<Groupe titre="Parcours" resume={resumes.parcours} ouvert={blocOuvert === 'parcours'}>
			<div class="bloc">
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
			</div>
		</Groupe>

		<Groupe titre="Équipe et statut" resume={resumes.equipe} ouvert={blocOuvert === 'equipe'}>
			<div class="bloc">
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
							name="equipeId"
							libelle="Équipe"
							aide="Le changement prend effet aujourd'hui."
							valeur={fiche.equipe ? String(fiche.equipe.id) : 'aucune'}
							erreur={erreurs.equipeId}
							options={[{ valeur: 'aucune', libelle: 'Aucune équipe' }, ...data.equipes.map((e) => ({ valeur: String(e.id), libelle: e.nom }))]}
						/>
						<Bouton type="submit">Enregistrer</Bouton>
					</form>
					<form method="POST" action="?/statut">
						<Choix
							id="statut"
							name="statut"
							libelle="Statut"
							valeur={statutAffiche}
							erreur={erreurs.statut}
							options={statuts.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] }))}
						/>
						<Bouton type="submit">Enregistrer</Bouton>
					</form>
				{/if}
			</div>
		</Groupe>

		<Groupe titre="Rôles" resume={resumes.roles} ouvert={blocOuvert === 'roles'}>
			<div class="bloc">
				<!-- Le rôle terminé ou raccourci peut quitter sa liste : le succès s'annonce ici. -->
				<div role="status">{#if annonceRole}<p class="succes">{annonceRole}</p>{/if}</div>
				{#if data.attributions.enCours.length === 0}
					<p>Aucune responsabilité en cours.</p>
				{:else}
					{@render liste('En cours', data.attributions.enCours)}
				{/if}
				{#if data.attributions.aVenir.length > 0}
					{@render liste('À venir', data.attributions.aVenir)}
				{/if}
				{#if data.attributions.passees.length > 0}
					<details>
						<summary>Passées ({data.attributions.passees.length})</summary>
						<ul class="roles">
							{#each data.attributions.passees as l (l.id)}
								<li><div><strong>{intitule(l)}</strong> <span class="note">{periode(l)} · saisi par {l.saisiePar}</span></div></li>
							{/each}
						</ul>
					</details>
				{/if}

				{#if choix}
					<form method="POST" action="?/attribuer" class="nomination" use:enhance={surEnvoi('attribuer')}>
						<h3>Attribuer une responsabilité</h3>
						<!-- Zones présentes dès le chargement : le message y est annoncé. -->
						<div role="status">{#if concerne('attribuer') && form?.succes}<p class="succes">{form.message}</p>{/if}</div>
						<div role="alert">
							{#if concerne('attribuer') && !form?.succes && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
						</div>
						<Choix
							id="responsabilite"
							name="responsabiliteId"
							libelle="Responsabilité"
							bind:valeur={responsabiliteChoisie}
							erreur={erreursNomination.responsabiliteId}
							options={nominations.map((r) => ({ valeur: String(r.responsabiliteId), libelle: r.nom }))}
						/>
						{#if choix.portee === 'centre'}
							<input type="hidden" name="perimetre" value="centre" />
						{:else}
							{#key choix.responsabiliteId}
								<Choix
									id="perimetre"
									name="perimetre"
									libelle={choix.portee === 'equipe' ? 'Équipe' : 'Comité'}
									valeur={perimetreInitial}
									erreur={erreursNomination.perimetreId}
									options={choix.perimetres.map((p) => ({ valeur: String(p.id), libelle: p.nom }))}
								/>
							{/key}
						{/if}
						<Champ id="debut" name="debut" type="date" libelle="Début" requis valeur={saisie('debut', aujourdhuiIso)} erreur={erreursNomination.debut} />
						<Champ id="fin" name="fin" type="date" libelle="Fin" aide="Facultative : sans date, le rôle dure jusqu'à ce qu'on le termine." valeur={saisie('fin', '')} erreur={erreursNomination.fin} />
						<Bouton type="submit" desactive={envoi === 'attribuer'}>Attribuer</Bouton>
					</form>
				{/if}
			</div>
		</Groupe>

		<Groupe titre="Départ du centre" resume={resumes.depart} couleur="var(--rouge)" ouvert={blocOuvert === 'depart'}>
			<div class="bloc">
				{#if data.raison}
					<p class="raison">{data.raison}</p>
				{:else if fiche.statut === 'parti'}
					<p>A quitté le centre. Pour le réintégrer, changez son statut dans « Équipe et statut ».</p>
				{:else}
					<form method="POST" action="?/statut">
						<input type="hidden" name="statut" value="parti" />
						<p id="depart-avertissement"><strong>Attention :</strong> Sa date de naissance et son contact d'urgence seront effacés, et ses rôles prendront fin aujourd'hui.</p>
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
						<Bouton type="submit">Déclarer le départ</Bouton>
					</form>
				{/if}
			</div>
		</Groupe>
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
	.bloc {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
	}
	.entete {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--trait-doux);
		border-bottom: 3px solid var(--rouge);
		border-radius: var(--rayon-grand);
	}
	.qui {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.doux {
		color: var(--doux);
	}
	.etiquettes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.role {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 10px 2px 2px;
		border: 1px solid var(--trait-doux);
		border-radius: 999px;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.contact {
		display: flex;
		gap: 8px;
	}
	.contact a {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--cible);
		border: 1px solid var(--trait);
		border-radius: 12px;
		color: var(--encre);
		font-weight: 600;
		text-decoration: none;
	}
	.contact a:hover {
		text-decoration: underline;
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
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 16px;
		margin: 0;
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
	h3 {
		margin: 8px 0 0;
		font: 700 1.125rem var(--police-titre);
	}
	.roles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.roles li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.roles li > div {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	form.terminer,
	form.finir {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	form.finir {
		align-items: flex-end;
	}
	.roles form + form {
		margin-top: 0;
		padding-top: 0;
		border-top: none;
	}
	form.nomination {
		margin-top: 24px;
		padding-top: 24px;
		border-top: 1px solid var(--trait);
	}
	form.nomination h3 {
		margin: 0;
	}
	summary {
		cursor: pointer;
		font-weight: 600;
		min-height: var(--cible);
		display: flex;
		align-items: center;
	}
</style>

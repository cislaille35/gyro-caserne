<script lang="ts">
	import { DESSINS } from '#lib/ui/icones-roles.ts';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { rechercheListe } from '#lib/liste-agents.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import PastilleEquipe from '#lib/ui/PastilleEquipe.svelte';
	import Statut from '#lib/ui/Statut.svelte';
	import { LIBELLES_STATUT } from '#lib/ui/statut.ts';
	import Visage from '#lib/ui/Visage.svelte';

	let { data, form } = $props();

	const fiche = $derived(data.fiche);
	// Après un envoi, la liste à côté garde sa recherche et son filtre.
	const action = (nom: string) => `?/${nom}${rechercheListe(page.url).replace('?', '&')}`;
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

	// « Parti » se déclare dans son propre bloc. Un agent parti se réintègre en choisissant un statut.
	const statuts = $derived(data.statuts.filter((s) => s !== 'parti'));
	const statutAffiche = $derived(valeurs.statut && statuts.some((s) => s === valeurs.statut) ? valeurs.statut : fiche.statut === 'parti' ? '' : fiche.statut);

	// Résumés des blocs fermés.
	const enCours = $derived(data.attributions.enCours);
	const sousTitre = $derived([fiche.grade?.libelle, fiche.equipe?.nom].filter(Boolean).join(' · '));
	const resumes = $derived({
		identite: [fiche.email, fiche.telephone].filter(Boolean).join(' · '),
		parcours: [fiche.grade?.libelle ?? 'Aucun grade', fiche.entreeCentre && `au centre depuis ${fiche.entreeCentre.slice(0, 4)}`].filter(Boolean).join(' · '),
		equipe: `${fiche.equipe?.nom ?? 'Aucune équipe'} · ${LIBELLES_STATUT[fiche.statut]}`,
		aptitudes: data.aptitudes.length ? data.aptitudes.map((a) => (a.valide ? a.nom : `${a.nom} (expirée)`)).join(', ') : 'Aucune aptitude',
		roles: [enCours.length ? enCours.map(intitule).join(', ') : 'Aucun rôle en cours', data.attributions.aVenir.length && `${data.attributions.aVenir.length} à venir`].filter(Boolean).join(', '),
		depart: fiche.statut === 'parti' ? 'A quitté le centre' : (data.raison ?? 'Fin des rôles, données personnelles effacées')
	});

	// Le bloc concerné par le dernier envoi s'ouvre seul : on y voit l'erreur ou le message.
	const IDENTITE = ['prenom', 'nom', 'email', 'telephone', 'naissance'];
	const PARCOURS = ['gradeId', 'dateGrade', 'profilId', 'entreeCentre', 'engagementSpv'];
	const blocOuvert = $derived.by(() => {
		if (form?.cible) return 'roles';
		if (!generale) return null;
		if (generale.succes || generale.bloc === 'aptitudes') return generale.bloc ?? null;
		// Les champs en erreur, ou à défaut ceux envoyés, désignent le formulaire.
		const champs = Object.keys({ ...valeurs, ...erreurs });
		if (champs.includes('confirmation') || valeurs.statut === 'parti') return 'depart';
		if (champs.some((c) => IDENTITE.includes(c))) return 'identite';
		if (champs.some((c) => PARCOURS.includes(c))) return 'parcours';
		if (champs.includes('equipeId') || champs.includes('statut')) return 'equipe';
		return null;
	});
	const chiffres = (tel: string) => tel.replace(/[^\d+]/g, '');
	const GESTES = {
		message: 'M4 5h16v11H9l-5 4z',
		courriel: 'M3 6h18v12H3z M3 7l9 6 9-6',
		appeler: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'
	};
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
					<form method="POST" action={action('finir')} class="finir" use:enhance={surEnvoi(finir)}>
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
					<form method="POST" action={action('terminer')} class="terminer" use:enhance={surEnvoi(cible)}>
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

{#snippet pictogramme(trace: string)}
	<span class="rond" aria-hidden="true"
		><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={trace} /></svg></span
	>
{/snippet}

{#key fiche.id}
	<div class="fiche">
		<header class="entete" style:--teinte={fiche.equipe?.couleur ?? null}>
			<div class="bandeau" aria-hidden="true"></div>
			<div class="corps">
				<span class="visage"><Visage prenom={fiche.prenom} nom={fiche.nom} couleur={fiche.equipe?.couleur ?? null} taille={88} /></span>
				<h1 tabindex="-1">{fiche.prenom} {fiche.nom}</h1>
				{#if sousTitre}<p class="doux">{sousTitre}</p>{/if}
				<ul class="etiquettes" aria-label="Statut et rôles en cours">
					<li><Statut statut={fiche.statut} /></li>
					{#each enCours as l (l.id)}
						<li class="role"><IconeRole icone={l.responsabilite.icone} taille={24} />{intitule(l)}</li>
					{/each}
				</ul>
				<ul class="contact" aria-label="Contacter">
					{#if data.ecrire}<li><a href="/echanges/messages/a/{fiche.id}">{@render pictogramme(GESTES.message)}Message</a></li>{/if}
					<li><a href="mailto:{fiche.email}">{@render pictogramme(GESTES.courriel)}Courriel</a></li>
					{#if fiche.telephone}<li><a href="tel:{chiffres(fiche.telephone)}">{@render pictogramme(GESTES.appeler)}Appeler</a></li>{/if}
				</ul>
			</div>
		</header>

		<div class="annonces">
			<div role="status">
				{#if generale?.succes}<p class="succes">{generale.message}</p>{/if}
			</div>
			<div role="alert">
				{#if generale && !generale.succes && (generale.message || generale.erreurs)}<p class="echec">{generale.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
			</div>
		</div>

		<div class="pile">
		<Groupe titre="Identité et contact" icone="livre" dessin={DESSINS.profil} resume={resumes.identite} ouvert={blocOuvert === 'identite'}>
			<div class="bloc">
				{#if data.raison}
					<p class="raison">{data.raison}</p>
					<dl>
						<dt>E-mail</dt><dd>{fiche.email}</dd>
						<dt>Téléphone</dt><dd>{fiche.telephone ?? '—'}</dd>
						<dt>Date de naissance</dt><dd>{date(fiche.naissance)}</dd>
					</dl>
				{:else}
					<form method="POST" action={action('fiche')}>
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

		<Groupe titre="Parcours" icone="casque" resume={resumes.parcours} ouvert={blocOuvert === 'parcours'}>
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
					<form method="POST" action={action('fiche')}>
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

		<Groupe titre="Équipe et statut" icone="groupe" resume={resumes.equipe} ouvert={blocOuvert === 'equipe'}>
			<div class="bloc">
				{#if data.raison}
					<p class="raison">{data.raison}</p>
					<dl>
						<dt>Équipe</dt><dd>{#if fiche.equipe}<PastilleEquipe nom={fiche.equipe.nom} couleur={fiche.equipe.couleur} />{:else}Aucune équipe{/if}</dd>
						<dt>Statut</dt><dd>{LIBELLES_STATUT[fiche.statut]}</dd>
					</dl>
				{:else}
					<form method="POST" action={action('equipe')}>
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
					<form method="POST" action={action('statut')}>
						<Choix
							id="statut"
							name="statut"
							libelle="Statut"
							valeur={statutAffiche}
							erreur={erreurs.statut}
							options={[...(fiche.statut === 'parti' ? [{ valeur: '', libelle: 'À choisir' }] : []), ...statuts.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] }))]}
						/>
						<Bouton type="submit">Enregistrer</Bouton>
					</form>
				{/if}
			</div>
		</Groupe>

		<Groupe titre="Rôles" icone="cle" resume={resumes.roles} ouvert={blocOuvert === 'roles'}>
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
					<details class="repli">
						<summary>Passées ({data.attributions.passees.length})</summary>
						<ul class="roles">
							{#each data.attributions.passees as l (l.id)}
								<li><div><strong>{intitule(l)}</strong> <span class="note">{periode(l)} · saisi par {l.saisiePar}</span></div></li>
							{/each}
						</ul>
					</details>
				{/if}

				{#if choix}
					<form method="POST" action={action('attribuer')} class="nomination" use:enhance={surEnvoi('attribuer')}>
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

		<Groupe titre="Aptitudes" icone="etoile" resume={resumes.aptitudes} ouvert={blocOuvert === 'aptitudes'}>
			<div class="bloc">
				{#if data.aptitudes.length === 0}
					<p>Aucune aptitude enregistrée.</p>
				{:else}
					<ul class="roles">
						{#each data.aptitudes as a (a.aptitudeId)}
							<li>
								<div>
									<strong>{a.nom}{#if !a.valide}<span class="expiree">Pas valable aujourd’hui</span>{/if}</strong>
									<span class="note">obtenue le {date(a.obtenueLe)}{a.expireLe ? `, expire le ${date(a.expireLe)}` : ''}{a.controlee ? ', contrôlée en remplacement' : ''}</span>
								</div>
								{#if !data.raison}
									<form method="POST" action={action('oterAptitude')} class="terminer">
										<input type="hidden" name="aptitudeId" value={a.aptitudeId} />
										<Bouton type="submit" variante="secondaire">Retirer<span class="masque"> {a.nom}</span></Bouton>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if !data.raison && data.aptitudesDuCentre.length > 0}
					<form method="POST" action={action('aptitude')} class="nomination">
						<h3>Ajouter ou corriger une aptitude</h3>
						<Choix id="aptitude" name="aptitudeId" libelle="Aptitude" valeur={String(data.aptitudesDuCentre[0]!.id)} options={data.aptitudesDuCentre.map((a) => ({ valeur: String(a.id), libelle: a.nom }))} />
						<Champ id="obtenue" name="obtenueLe" type="date" libelle="Obtenue le" requis valeur={aujourdhuiIso} />
						<Champ id="expire" name="expireLe" type="date" libelle="Expire le" aide="Facultative : sans date, l’aptitude vaut jusqu’à ce qu’on la retire." />
						<Bouton type="submit">Enregistrer l’aptitude</Bouton>
					</form>
				{/if}
			</div>
		</Groupe>

		<Groupe titre="Départ du centre" icone="etoile" dessin={DESSINS.sortir} resume={resumes.depart} ouvert={blocOuvert === 'depart'}>
			<div class="bloc">
				{#if data.raison}
					<p class="raison">{data.raison}</p>
				{:else if fiche.statut === 'parti'}
					<p>A quitté le centre. Pour le réintégrer, changez son statut dans « Équipe et statut ».</p>
					{#if erreurs.confirmation}<p class="erreur">{erreurs.confirmation}</p>{/if}
				{:else}
					<form method="POST" action={action('statut')}>
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
						<Bouton type="submit" variante="grave">Déclarer le départ</Bouton>
					</form>
				{/if}
			</div>
		</Groupe>
		</div>
	</div>
{/key}

<style>
	/* Les zones d'annonce restent en place, vides, sans creuser d'écart. */
	.annonces {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
		margin: -8px 0;
	}
	.annonces:not(:has(p)) {
		margin: -16px 0 0;
	}
	.fiche,
	form {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	form + form {
		margin-top: var(--espace-24);
		padding-top: var(--espace-24);
		border-top: 1px solid var(--trait);
	}
	form :global(button) {
		align-self: flex-start;
	}
	.expiree {
		margin-left: var(--espace-6);
		padding: 0 var(--espace-8);
		border-radius: 999px;
		border: 1px solid var(--statut-alerte-trait);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
		font-size: var(--texte-14);
		font-weight: 600;
	}
	.bloc {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-16);
	}
	/* La carte d'identité : un bandeau à la couleur de l'équipe, le visage à cheval. */
	.entete {
		overflow: hidden;
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.bandeau {
		height: 64px;
		background: var(--teinte, var(--statut-neutre-fond));
	}
	.corps {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--espace-8);
		padding: 0 var(--espace-16) var(--espace-16);
		text-align: center;
	}
	.visage {
		margin-top: -48px;
		border: 4px solid var(--surface);
		border-radius: 50%;
		display: inline-flex;
	}
	h1 {
		margin: 0;
		font: 700 var(--texte-30)/1.1 var(--police-titre);
		overflow-wrap: anywhere;
	}
	h1:focus {
		outline: none;
	}
	.doux {
		color: var(--doux);
	}
	.etiquettes,
	.contact {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: var(--espace-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.role {
		display: inline-flex;
		align-items: center;
		gap: var(--espace-6);
		padding: 2px var(--espace-12) 2px 2px;
		border: 1px solid var(--trait-doux);
		border-radius: 999px;
		font-size: var(--texte-14);
		font-weight: 600;
	}
	.contact {
		gap: var(--espace-20);
		margin-top: var(--espace-6);
	}
	.contact a {
		min-width: 64px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--espace-4);
		color: var(--encre);
		font-size: var(--texte-14);
		font-weight: 600;
		text-decoration: none;
	}
	.rond {
		width: 48px;
		height: 48px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--statut-danger-fond);
		color: var(--accent);
	}
	@media (hover: hover) and (pointer: fine) {
		.contact a:hover .rond {
			background: var(--rouge);
			color: var(--sur-rouge);
		}
	}
	@media (hover: hover) and (pointer: fine) {
		.contact a:hover {
			text-decoration: underline;
		}
	}
	p {
		margin: 0;
	}
	.succes,
	.echec,
	.raison {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 1px solid var(--trait);
		font-weight: 600;
	}
	.echec {
		border-color: var(--accent);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--espace-8) var(--espace-16);
		margin: 0;
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	.note {
		margin-top: var(--espace-8);
		color: var(--doux);
		font-size: var(--texte-15);
	}
	label {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
		font-weight: 600;
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
	}
	h3 {
		margin: var(--espace-8) 0 0;
		font: 700 var(--texte-18) var(--police-titre);
	}
	.roles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.roles li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--espace-12);
	}
	.roles li > div {
		display: flex;
		flex-direction: column;
		gap: var(--espace-4);
	}
	form.terminer,
	form.finir {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-12);
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
		margin-top: var(--espace-24);
		padding-top: var(--espace-24);
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

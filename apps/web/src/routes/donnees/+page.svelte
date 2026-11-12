<script lang="ts">
	import centre from '$centre';
	import Carte from '#lib/ui/Carte.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	// Ouverte à tous, connexion comprise : rien n'y est lu dans la base.
	let { data } = $props();
	const connecte = $derived(Boolean(data?.connecte));
</script>

<svelte:head>
	<title>Vos données · Gyro Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage
		titre="Vos données dans Gyro Caserne"
		phrase="Ce que l’appli garde sur vous, où, qui le voit et combien de temps."
		retour={connecte ? { href: '/moi', libelle: 'Moi' } : { href: '/connexion', libelle: 'Connexion' }}
	/>

	<div class="pile">
		<Carte titre="Ce qui est gardé">
			<ul>
				<li>Saisi par le centre : nom, prénom, adresse e-mail, équipe, grade, aptitudes, rôles et comités.</li>
				<li>Si vous le choisissez : téléphone, contact d’urgence, date de naissance, surnom, photo.</li>
				<li>Ce que vous faites dans l’appli : disponibilités, remplacements, messages, publications, prises de garde, réservations, demandes de tenue.</li>
			</ul>
			<p class="doux">Pas de mot de passe : vous vous connectez par un lien reçu par e-mail.</p>
		</Carte>

		<Carte titre="Où">
			<p>Chez Cloudflare, dans une base installée dans l’Union européenne. Rien n’est revendu ni utilisé pour de la publicité.</p>
			<p>Le lien de connexion part par Brevo, un service d’envoi d’e-mails. Les notifications passent, chiffrées, par le service du téléphone (Google ou Apple).</p>
		</Carte>

		<Carte titre="Qui les voit">
			<ul>
				<li>Les agents du centre : votre nom, votre équipe, votre grade, vos aptitudes et le planning. Votre téléphone et votre anniversaire, seulement si vous l’avez choisi.</li>
				<li>Le chef de centre et son adjoint : votre fiche entière, contact d’urgence compris.</li>
				<li>Un message : seulement les membres de la conversation.</li>
			</ul>
		</Carte>

		<Carte titre="Combien de temps">
			<ul>
				<li>Messages : {centre.conservationMessagesMois} mois.</li>
				<li>Publications des murs et leurs photos : {centre.conservationPublicationsMois} mois, sauf celles épinglées.</li>
				<li>Réservations : 12 mois après leur fin. Demandes de tenue : 24 mois après leur fin. Notifications : 30 jours.</li>
				<li>À votre départ, votre date de naissance et votre contact d’urgence sont effacés tout de suite. Le reste l’est 12 mois après votre départ : votre nom devient alors « Ancien agent » dans l’historique.</li>
			</ul>
		</Carte>

		<Carte titre="Copie de sécurité">
			<p>Chaque semaine, une copie chiffrée de la base part dans la boîte e-mail du centre. Seul le responsable de l’appli peut l’ouvrir. Les copies sont gardées 3 mois.</p>
		</Carte>

		<Carte titre="Corriger ou effacer">
			{#if connecte}
				<p>Votre téléphone, votre surnom et votre contact d’urgence se corrigent dans <a href="/profil">Mon profil</a>.</p>
			{:else}
				<p>Votre téléphone, votre surnom et votre contact d’urgence se corrigent dans « Mon profil », une fois connecté.</p>
			{/if}
			<p>Pour le reste, ou pour que vos données soient effacées sans attendre, demandez au chef de centre. Un effacement disparaît aussi des copies de sécurité au plus tard 3 mois après.</p>
		</Carte>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-lecture);
		margin-inline: auto;
	}
	p,
	ul {
		margin: 0;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
		padding-left: var(--espace-20);
	}
	.pile :global(section) {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	/* Le titre de la carte suit sa propre marge : le pas de la colonne suffit. */
	.pile :global(h2) {
		margin-bottom: var(--espace-4);
	}
</style>

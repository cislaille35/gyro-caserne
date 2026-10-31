<script module lang="ts">
	import type { EtatPush } from '#lib/push.ts';
	// `verification` : avant que la page sache (sans JavaScript, elle le dit) ; `sans-cles` : le centre n'a pas encore ses clés.
	export type EtatTelephone = EtatPush | 'verification' | 'sans-cles' | 'en-cours';
</script>

<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';

	// Ce téléphone (cet appareil) : ce qu'on peut y faire, selon ce que le navigateur permet.
	let {
		etat,
		appareils,
		echec = false,
		activer,
		desactiver
	}: { etat: EtatTelephone; appareils: number; echec?: boolean; activer: () => void; desactiver: () => void } = $props();
</script>

<div class="telephone">
	{#if etat === 'verification'}
		<p class="doux">Vérification de ce téléphone…</p>
		<noscript><p>Pour activer les notifications, il faut JavaScript.</p></noscript>
	{:else if etat === 'sans-cles'}
		<p>Les notifications au téléphone ne sont pas encore en place pour ce centre. La cloche de l’appli, elle, marche déjà.</p>
	{:else if etat === 'indisponible'}
		<p>Ce navigateur ne reçoit pas les notifications. Ouvrez l’appli avec Chrome, Firefox, Edge ou Safari.</p>
	{:else if etat === 'ios-a-installer'}
		<p>Sur iPhone, ajoutez d’abord l’appli à l’écran d’accueil (Apple l’exige) :</p>
		<ol>
			<li>Dans Safari, touchez <strong>Partager</strong> (le carré avec une flèche vers le haut).</li>
			<li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li>
			<li>Ouvrez Gyro Caserne depuis son icône, revenez ici et touchez <strong>Activer sur ce téléphone</strong>.</li>
		</ol>
	{:else if etat === 'refuse'}
		<p>Les notifications sont bloquées pour l’appli sur ce téléphone. Autorisez-les dans les réglages du téléphone ou du navigateur (Notifications, Gyro Caserne), puis revenez ici.</p>
	{:else if etat === 'actif'}
		<p class="etat"><Pastille ton="ok">Activées sur ce téléphone</Pastille></p>
		<p class="doux">Vous recevez les publications de vos murs, les commentaires sous les vôtres et vos messages.</p>
		<div><Bouton variante="secondaire" onclick={desactiver}>Désactiver sur ce téléphone</Bouton></div>
	{:else}
		<p>Recevez une notification pour chaque publication de vos murs, chaque commentaire sous les vôtres et chaque message.</p>
		<div><Bouton onclick={activer} desactive={etat === 'en-cours'}>{etat === 'en-cours' ? 'Activation…' : 'Activer sur ce téléphone'}</Bouton></div>
	{/if}
	<p class="echec" role="alert">{echec ? 'L’activation n’a pas abouti. Réessayez dans un instant.' : ''}</p>
	{#if appareils > 0}<p class="doux">Activées sur {pluriel(appareils, 'appareil')} en tout.</p>{/if}
</div>

<style>
	.telephone {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	p,
	ol {
		margin: 0;
	}
	ol {
		padding-left: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.doux {
		color: var(--doux);
	}
	.echec:empty {
		display: none;
	}
	.echec {
		color: var(--statut-danger-texte);
		font-weight: 600;
	}
</style>

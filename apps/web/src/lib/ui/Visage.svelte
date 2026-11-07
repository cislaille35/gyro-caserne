
<script lang="ts">
	import { encreSur } from '../couleurs.ts';

	// Le nom est toujours écrit à côté : le visage est décoratif. Sans couleur d'équipe, il est gris.
	let { prenom, nom, couleur, taille = 40 }: { prenom: string; nom: string; couleur: string | null; taille?: 88 | 52 | 48 | 44 | 40 | 30 } = $props();

	const initiales = $derived(`${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase());
	const teinte = $derived(couleur && /^#[0-9a-f]{6}$/i.test(couleur) ? couleur : null);
</script>

<span
	class="visage"
	class:petit={taille === 30}
	class:grand={taille === 52}
	class:t48={taille === 48}
	class:t44={taille === 44}
	class:t88={taille === 88}
	aria-hidden="true"
	style:background={teinte ?? 'var(--statut-neutre-fond)'}
	style:color={teinte ? encreSur(teinte) : 'var(--statut-neutre-texte)'}>{initiales}</span
>

<style>
	.visage {
		flex: none;
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		font-weight: 700;
		font-size: 0.9375rem;
		line-height: 1;
	}
	.grand {
		width: 52px;
		height: 52px;
		font-size: 1.125rem;
	}
	.t48 {
		width: 48px;
		height: 48px;
		font-size: 1.0625rem;
	}
	.t44 {
		width: 44px;
		height: 44px;
		font-size: 1rem;
	}
	.t88 {
		width: 88px;
		height: 88px;
		font-size: 1.75rem;
	}
	.petit {
		width: 30px;
		height: 30px;
		font-size: 0.6875rem;
		border: 2px solid var(--surface);
	}
</style>

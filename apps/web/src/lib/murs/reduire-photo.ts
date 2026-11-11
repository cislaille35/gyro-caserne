// Côté long : 1600 px, puis 1200 et 1000 px pour une photo très détaillée qui reste trop lourde.
const COTES = [1600, 1200, 1000];
// Comme TAILLE_PHOTO_MAX du socle (refus au-delà côté serveur).
const TAILLE_MAX = 200 * 1024;
// Qualité ≈ 0,8 ; une photo qui dépasse encore 200 Ko est refaite un peu moins fine.
const QUALITES = [0.8, 0.6, 0.4];

// Réduit une photo dans le navigateur avant l'envoi, en JPEG de 200 Ko au plus : côté long à 1600 px au plus, moins si besoin.
export async function reduirePhoto(fichier: File): Promise<Blob> {
	if (!fichier.type.startsWith('image/')) throw new Error(`« ${fichier.name} » n’est pas une image`);
	let image: ImageBitmap;
	try {
		image = await createImageBitmap(fichier);
	} catch {
		throw new Error(`« ${fichier.name} » est illisible`);
	}
	try {
		let precedente = '';
		for (const cote of COTES) {
			const echelle = Math.min(1, cote / Math.max(image.width, image.height));
			const largeur = Math.round(image.width * echelle);
			const hauteur = Math.round(image.height * echelle);
			// Une petite image garde sa taille : inutile de la refaire à l'identique.
			if (`${largeur}x${hauteur}` === precedente) continue;
			precedente = `${largeur}x${hauteur}`;
			const toile = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(largeur, hauteur) : null;
			const contexte = toile?.getContext('2d');
			if (!toile || !contexte) throw new Error('Votre navigateur ne peut pas réduire cette photo ; essayez avec un autre navigateur');
			contexte.drawImage(image, 0, 0, largeur, hauteur);
			for (const quality of QUALITES) {
				const blob = await toile.convertToBlob({ type: 'image/jpeg', quality });
				if (blob.size <= TAILLE_MAX) return blob;
			}
		}
		throw new Error('Photo trop détaillée, essayez-en une autre');
	} finally {
		image.close();
	}
}

// L'écusson du centre : une image souvent transparente (PNG). Refaite en WebP, qui garde la transparence, côté long à 512 px au
// plus ; un navigateur qui ne sait pas écrire de WebP (Safari) donne un JPEG sur fond blanc, plutôt que noir.
export async function reduireEcusson(fichier: File): Promise<Blob> {
	if (!fichier.type.startsWith('image/')) throw new Error(`« ${fichier.name} » n’est pas une image`);
	let image: ImageBitmap;
	try {
		image = await createImageBitmap(fichier);
	} catch {
		throw new Error(`« ${fichier.name} » est illisible`);
	}
	try {
		const echelle = Math.min(1, 512 / Math.max(image.width, image.height));
		const toile = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(Math.round(image.width * echelle), Math.round(image.height * echelle)) : null;
		const contexte = toile?.getContext('2d');
		if (!toile || !contexte) throw new Error('Votre navigateur ne peut pas réduire cette image ; essayez avec un autre navigateur');
		contexte.drawImage(image, 0, 0, toile.width, toile.height);
		for (const quality of QUALITES) {
			const blob = await toile.convertToBlob({ type: 'image/webp', quality });
			if (blob.type !== 'image/webp') break;
			if (blob.size <= TAILLE_MAX) return blob;
		}
		contexte.globalCompositeOperation = 'destination-over';
		contexte.fillStyle = '#ffffff';
		contexte.fillRect(0, 0, toile.width, toile.height);
		for (const quality of QUALITES) {
			const blob = await toile.convertToBlob({ type: 'image/jpeg', quality });
			if (blob.size <= TAILLE_MAX) return blob;
		}
		throw new Error('Image trop détaillée, essayez-en une autre');
	} finally {
		image.close();
	}
}

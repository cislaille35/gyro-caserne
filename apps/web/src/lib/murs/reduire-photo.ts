const COTE_MAX = 1600;
const TAILLE_MAX = 400 * 1024;
// Qualité ≈ 0,8 ; une photo très détaillée qui dépasse encore 400 Ko est refaite un peu moins fine.
const QUALITES = [0.8, 0.6, 0.4];

// Réduit une photo dans le navigateur avant l'envoi : côté long à 1600 px au plus, en JPEG.
export async function reduirePhoto(fichier: File): Promise<Blob> {
	if (!fichier.type.startsWith('image/')) throw new Error(`« ${fichier.name} » n’est pas une image`);
	let image: ImageBitmap;
	try {
		image = await createImageBitmap(fichier);
	} catch {
		throw new Error(`« ${fichier.name} » est illisible`);
	}
	const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
	const largeur = Math.round(image.width * echelle);
	const hauteur = Math.round(image.height * echelle);
	const toile = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(largeur, hauteur) : null;
	const contexte = toile?.getContext('2d');
	if (!toile || !contexte) {
		image.close();
		throw new Error('Votre navigateur ne peut pas réduire cette photo ; essayez avec un autre navigateur');
	}
	contexte.drawImage(image, 0, 0, largeur, hauteur);
	image.close();
	let blob!: Blob;
	for (const quality of QUALITES) {
		blob = await toile.convertToBlob({ type: 'image/jpeg', quality });
		if (blob.size <= TAILLE_MAX) break;
	}
	return blob;
}

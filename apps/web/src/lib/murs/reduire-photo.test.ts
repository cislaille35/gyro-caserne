import { afterEach, describe, expect, it, vi } from 'vitest';
import { reduirePhoto } from './reduire-photo.ts';

// Le navigateur est simulé : l'image décodée et le canevas notent ce qu'on leur demande.
function simuler(largeur: number, hauteur: number) {
	const appels: { taille?: [number, number]; dessin?: number[]; options?: unknown } = {};
	const fermer = vi.fn();
	vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: largeur, height: hauteur, close: fermer })));
	vi.stubGlobal(
		'OffscreenCanvas',
		class {
			constructor(l: number, h: number) {
				appels.taille = [l, h];
			}
			getContext() {
				return { drawImage: (_image: unknown, ...reste: number[]) => (appels.dessin = reste) };
			}
			async convertToBlob(options: unknown) {
				appels.options = options;
				return new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
			}
		}
	);
	return { appels, fermer };
}

afterEach(() => vi.unstubAllGlobals());

describe('reduirePhoto', () => {
	it('ramène le côté long à 1600 px, en JPEG qualité 0,8', async () => {
		const { appels, fermer } = simuler(4000, 3000);
		const blob = await reduirePhoto(new File([new Uint8Array(10)], 'photo.png', { type: 'image/png' }));
		expect(appels.taille).toEqual([1600, 1200]);
		expect(appels.dessin).toEqual([0, 0, 1600, 1200]);
		expect(appels.options).toEqual({ type: 'image/jpeg', quality: 0.8 });
		expect(blob.type).toBe('image/jpeg');
		expect(fermer).toHaveBeenCalled();
	});

	it('garde la taille d’une petite image, en portrait aussi', async () => {
		const { appels } = simuler(900, 1200);
		await reduirePhoto(new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' }));
		expect(appels.taille).toEqual([900, 1200]);
		const grand = simuler(1000, 3200).appels;
		await reduirePhoto(new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' }));
		expect(grand.taille).toEqual([500, 1600]);
	});

	it('baisse la qualité tant que la photo dépasse 200 Ko', async () => {
		const qualites: number[] = [];
		simuler(1600, 1200);
		vi.stubGlobal(
			'OffscreenCanvas',
			class {
				getContext() {
					return { drawImage: () => {} };
				}
				async convertToBlob({ quality }: { quality: number }) {
					qualites.push(quality);
					return new Blob([new Uint8Array(quality > 0.5 ? 250 * 1024 : 150 * 1024)], { type: 'image/jpeg' });
				}
			}
		);
		const blob = await reduirePhoto(new File([new Uint8Array(10)], 'dense.jpg', { type: 'image/jpeg' }));
		expect(qualites).toEqual([0.8, 0.6, 0.4]);
		expect(blob.size).toBe(150 * 1024);
	});

	it('dépasse à 0,4 en 1600 px, puis passe en réduisant les dimensions', async () => {
		const essais: string[] = [];
		const { fermer } = simuler(4000, 3000);
		vi.stubGlobal(
			'OffscreenCanvas',
			class {
				constructor(public largeur: number, public hauteur: number) {}
				getContext() {
					return { drawImage: () => {} };
				}
				async convertToBlob({ quality }: { quality: number }) {
					essais.push(`${this.largeur}x${this.hauteur}@${quality}`);
					// Trop lourde en 1600 px quelle que soit la qualité ; en 1200 px, passe à 0,6.
					return new Blob([new Uint8Array(this.largeur > 1200 || quality > 0.6 ? 238 * 1024 : 180 * 1024)], { type: 'image/jpeg' });
				}
			}
		);
		const blob = await reduirePhoto(new File([new Uint8Array(10)], 'dense.jpg', { type: 'image/jpeg' }));
		expect(essais).toEqual(['1600x1200@0.8', '1600x1200@0.6', '1600x1200@0.4', '1200x900@0.8', '1200x900@0.6']);
		expect(blob.size).toBe(180 * 1024);
		expect(fermer).toHaveBeenCalled();
	});

	it('trop lourde même en 1000 px à 0,4 : refusée dans le navigateur, avec un message clair', async () => {
		const tailles: number[] = [];
		simuler(4000, 3000);
		vi.stubGlobal(
			'OffscreenCanvas',
			class {
				constructor(public largeur: number) {}
				getContext() {
					return { drawImage: () => {} };
				}
				async convertToBlob() {
					tailles.push(this.largeur);
					return new Blob([new Uint8Array(201 * 1024)], { type: 'image/jpeg' });
				}
			}
		);
		await expect(reduirePhoto(new File([new Uint8Array(10)], 'dense.jpg', { type: 'image/jpeg' }))).rejects.toThrow('Photo trop détaillée, essayez-en une autre');
		expect([...new Set(tailles)]).toEqual([1600, 1200, 1000]);
		expect(tailles).toHaveLength(9);
	});

	it('petite image : pas d’essai deux fois à la même taille', async () => {
		const tailles: number[] = [];
		simuler(900, 600);
		vi.stubGlobal(
			'OffscreenCanvas',
			class {
				constructor(public largeur: number) {}
				getContext() {
					return { drawImage: () => {} };
				}
				async convertToBlob() {
					tailles.push(this.largeur);
					return new Blob([new Uint8Array(201 * 1024)], { type: 'image/jpeg' });
				}
			}
		);
		await expect(reduirePhoto(new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' }))).rejects.toThrow('Photo trop détaillée');
		expect(tailles).toEqual([900, 900, 900]);
	});

	it('refuse un fichier qui n’est pas une image', async () => {
		simuler(10, 10);
		await expect(reduirePhoto(new File(['texte'], 'note.txt', { type: 'text/plain' }))).rejects.toThrow('« note.txt » n’est pas une image');
	});

	it('navigateur sans canevas : un message clair', async () => {
		simuler(800, 600);
		vi.stubGlobal('OffscreenCanvas', undefined);
		await expect(reduirePhoto(new File([new Uint8Array(3)], 'p.jpg', { type: 'image/jpeg' }))).rejects.toThrow('Votre navigateur ne peut pas réduire cette photo ; essayez avec un autre navigateur');
		vi.stubGlobal(
			'OffscreenCanvas',
			class {
				getContext() {
					return null;
				}
			}
		);
		await expect(reduirePhoto(new File([new Uint8Array(3)], 'p.jpg', { type: 'image/jpeg' }))).rejects.toThrow('Votre navigateur ne peut pas réduire cette photo');
	});

	it('refuse une image illisible', async () => {
		vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('décodage'))));
		await expect(reduirePhoto(new File([new Uint8Array(3)], 'abimee.jpg', { type: 'image/jpeg' }))).rejects.toThrow('« abimee.jpg » est illisible');
	});
});

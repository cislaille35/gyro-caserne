import type { Droit } from './listes.ts';
import type { Perimetre } from './droits.ts';

export class RefusDroit extends Error {
	constructor(
		readonly droit: Droit,
		readonly perimetre: Perimetre
	) {
		super(`Droit ${droit} refusé sur ${perimetre.type}${'id' in perimetre ? `:${perimetre.id}` : ''}`);
		this.name = 'RefusDroit';
	}
}

export class DonneeInvalide extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DonneeInvalide';
	}
}

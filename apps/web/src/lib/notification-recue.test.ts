import { describe, expect, it } from 'vitest';
import { aAfficher } from './notification-recue.ts';

describe('aAfficher (le service worker reçoit une notification)', () => {
	it('rien d’affiché pour ce fil : la notification reçue, avec des valeurs par défaut', () => {
		expect(aAfficher({ titre: 'Équipe 2', texte: 'Manœuvre', url: '/echanges', tag: 'publication:3', envoi: 7 }, [])).toEqual({ titre: 'Équipe 2', texte: 'Manœuvre', url: '/echanges', envoi: 7 });
		expect(aAfficher({}, [])).toEqual({ titre: 'Gyro Caserne', texte: '', url: '/', envoi: undefined });
	});

	it('un envoi repris après une coupure arrive après un plus récent du même fil : le plus récent reste affiché', () => {
		const recent = { titre: 'Bruno', texte: 'Message B', data: { url: '/echanges/messages/4', envoi: 12 } };
		expect(aAfficher({ titre: 'Bruno', texte: 'Message A', url: '/echanges/messages/4', tag: 'conversation:4', envoi: 9 }, [recent])).toEqual({ titre: 'Bruno', texte: 'Message B', url: '/echanges/messages/4', envoi: 12 });
		expect(aAfficher({ titre: 'Bruno', texte: 'Message C', url: '/echanges/messages/4', tag: 'conversation:4', envoi: 15 }, [recent])).toMatchObject({ texte: 'Message C', envoi: 15 });
	});
});

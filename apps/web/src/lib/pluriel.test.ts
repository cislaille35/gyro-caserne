import { describe, expect, it } from 'vitest';
import { pluriel } from './pluriel.ts';

describe('pluriel', () => {
	it('le nombre et le mot, au pluriel à partir de 2', () => {
		expect(pluriel(0, 'agent')).toBe('0 agent');
		expect(pluriel(1, 'agent')).toBe('1 agent');
		expect(pluriel(2, 'agent')).toBe('2 agents');
	});
	it('un pluriel irrégulier', () => {
		expect(pluriel(3, 'nouveau message', 'nouveaux messages')).toBe('3 nouveaux messages');
		expect(pluriel(1, 'nouveau message', 'nouveaux messages')).toBe('1 nouveau message');
	});
});

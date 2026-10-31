// « 1 agent », « 2 agents » ; le pluriel est donné quand il ne prend pas qu'un s.
export const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

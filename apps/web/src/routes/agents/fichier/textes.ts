// « 1 départ », « 3 départs ».
export const compter = (n: number, singulier: string, pluriel: string) => `${n} ${n > 1 ? pluriel : singulier}`;

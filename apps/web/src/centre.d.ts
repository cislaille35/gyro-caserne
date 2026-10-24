// Le centre choisi à la compilation (voir vite.config.ts)
declare module '$centre' {
	const centre: import('@gyro-caserne/centre').Centre;
	export default centre;
}

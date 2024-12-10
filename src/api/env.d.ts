
declare function setTimeout(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;

interface ImportMetaEnv {
	DEV?: boolean;
}

interface ImportMeta {
	env?: ImportMetaEnv;
}

declare module "cross-spawn" {
	import { ChildProcess, SpawnOptions } from "child_process";
	export function spawn(command: string, args?: string[], options?: SpawnOptions): ChildProcess;
}

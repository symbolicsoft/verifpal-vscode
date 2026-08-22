/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import { spawn } from "cross-spawn";
import type { ChildProcess } from "child_process";

/** Why a Verifpal invocation did not produce a usable result. */
export type RunFailure = "spawn" | "exit" | "timeout" | "cancelled";

/**
 * A failed invocation, carrying enough to tell the user something specific.
 *
 * `stderr` in particular is where Verifpal puts its `file:line:col` model
 * errors, which the diagnostics layer turns into squiggles — so it has to
 * survive as data rather than being collapsed into a message string.
 */
export class VerifpalRunError extends Error {
	readonly failure: RunFailure;
	readonly stdout: string;
	readonly stderr: string;
	readonly exitCode: number | null;
	/** `ENOENT` when the binary is not on PATH; undefined unless `failure` is "spawn". */
	readonly systemCode: string | undefined;

	constructor(
		failure: RunFailure,
		message: string,
		details: { stdout?: string; stderr?: string; exitCode?: number | null; systemCode?: string }
	) {
		super(message);
		this.name = "VerifpalRunError";
		this.failure = failure;
		this.stdout = details.stdout ?? "";
		this.stderr = details.stderr ?? "";
		this.exitCode = details.exitCode ?? null;
		this.systemCode = details.systemCode;
	}

	/** True when the failure was Verifpal rejecting the model, rather than a plumbing problem. */
	get isModelError(): boolean {
		return this.failure === "exit" && this.stderr.trim().length > 0;
	}
}

export interface RunResult {
	stdout: string;
	stderr: string;
}

export interface RunOptions {
	binary: string;
	args: string[];
	/** Model source, written to stdin and terminated with EOT the way Verifpal expects. */
	input: string;
	/** Milliseconds before the child is killed; omit or pass 0 for no limit. */
	timeoutMs?: number;
	signal?: AbortSignal;
}

const EOT = String.fromCharCode(0x04);
const SIGKILL_GRACE_MS = 2000;

/**
 * Runs one Verifpal invocation over stdin/stdout.
 *
 * Three things here are not incidental. It settles on `close` rather than
 * `exit`, because `exit` fires while stdout may still hold buffered data — a
 * JSON payload truncated mid-parse reads to the user as "your model is
 * invalid" on a model that is fine. It honours the exit code, so a non-zero
 * exit is a failure even if nothing reached stderr, and a zero exit is a
 * success even if something did. And it guards the stdin write, because
 * writing to a process that failed to spawn raises an unhandled stream error
 * in the extension host.
 */
export function runVerifpal(options: RunOptions): Promise<RunResult> {
	return new Promise<RunResult>((resolve, reject) => {
		let stdout = "";
		let stderr = "";
		let settled = false;
		let timer: NodeJS.Timeout | undefined;
		let killTimer: NodeJS.Timeout | undefined;
		let child: ChildProcess | undefined;

		// Deliberately does not clear `killTimer`: the promise settles as soon as
		// the child is asked to stop, but the escalation to SIGKILL has to
		// outlive that settlement or a child that ignores SIGTERM is left
		// running.
		const cleanup = (): void => {
			if (timer) {
				clearTimeout(timer);
			}
			options.signal?.removeEventListener("abort", onAbort);
		};

		const fail = (failure: RunFailure, message: string, exitCode: number | null = null, systemCode?: string): void => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			reject(new VerifpalRunError(failure, message, { stdout, stderr, exitCode, systemCode }));
		};

		const terminate = (failure: RunFailure, message: string): void => {
			if (settled) {
				return;
			}
			try {
				child?.kill("SIGTERM");
				killTimer = setTimeout(() => {
					try {
						child?.kill("SIGKILL");
					} catch {
						// The process is already gone; nothing to escalate to.
					}
				}, SIGKILL_GRACE_MS);
				killTimer.unref?.();
			} catch {
				// Killing failed because the process already exited.
			}
			fail(failure, message);
		};

		function onAbort(): void {
			terminate("cancelled", "Verifpal analysis was cancelled.");
		}

		try {
			child = spawn(options.binary, options.args, { windowsHide: true });
		} catch (e) {
			const err = e as NodeJS.ErrnoException;
			reject(new VerifpalRunError("spawn", err.message, { systemCode: err.code }));
			return;
		}

		if (options.signal) {
			if (options.signal.aborted) {
				terminate("cancelled", "Verifpal analysis was cancelled.");
				return;
			}
			options.signal.addEventListener("abort", onAbort, { once: true });
		}

		const timeoutMs = options.timeoutMs ?? 0;
		if (timeoutMs > 0) {
			const elapsed = timeoutMs >= 1000
				? `${Math.round(timeoutMs / 1000)} seconds`
				: `${timeoutMs}ms`;
			timer = setTimeout(() => {
				terminate("timeout", `Verifpal did not respond within ${elapsed}.`);
			}, timeoutMs);
			timer.unref?.();
		}

		child.on("error", (err: NodeJS.ErrnoException) => {
			fail("spawn", err.message, null, err.code);
		});

		child.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});
		child.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		// `close` waits for both pipes to drain, unlike `exit`.
		child.on("close", (code: number | null) => {
			if (killTimer) {
				clearTimeout(killTimer);
				killTimer = undefined;
			}
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			if (code === 0) {
				resolve({ stdout, stderr });
				return;
			}
			const detail =
				stderr.trim() ||
				lastLine(stdout) ||
				`Verifpal exited with status ${code ?? "unknown"}.`;
			reject(new VerifpalRunError("exit", detail, { stdout, stderr, exitCode: code }));
		});

		const stdin = child.stdin;
		if (!stdin) {
			terminate("spawn", "Verifpal could not be given the model to read.");
			return;
		}
		// A spawn failure surfaces here as a stream error rather than a throw.
		stdin.on("error", () => {
			// The `error` handler on the child reports it; swallowing here only
			// keeps the failure from becoming an unhandled event.
		});
		try {
			stdin.end(`${options.input}${EOT}`);
		} catch {
			// Same case: the child is gone, and its own error handler reports it.
		}
	});
}

/**
 * The last non-empty line of output.
 *
 * Used only as a fallback message when a run failed with nothing on stderr:
 * Verifpal's stdout during an analysis is a long narrative, and putting all of
 * it in a notification would be unreadable.
 */
function lastLine(text: string): string {
	const lines = text.split(/\r?\n/);
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (line.length > 0) {
			return line;
		}
	}
	return "";
}

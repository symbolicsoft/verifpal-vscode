/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import { extractJson, stripInfoLines } from "./parse";
import { runVerifpal, VerifpalRunError } from "./process";
import { configDeterminePath } from "./config";

/**
 * The `internal-json` interface, typed.
 *
 * Verifpal exposes four subcommands over stdin/stdout, documented in the
 * engine's `src/json.rs`. Every payload shape here mirrors one of them; keys
 * added by newer releases are optional so that an older Verifpal on the user's
 * PATH degrades rather than throws.
 */

export interface KnowledgeMapConstant {
	Name: string;
}

export interface KnowledgeMap {
	Constants: KnowledgeMapConstant[];
	Creator: string[];
	Assigned: string[];
	KnownBy: Record<string, string>[][];
	Principals: string[];
	Phase: number[][];
	MaxPhase: number;
}

/**
 * A weakening assumption the model declared on one primitive call site, such
 * as `SIGN[forgeable](sk, m)` or `AEAD_ENC[weak from phase 2](k, m, ad)`.
 * `FromPhase` is 0 unless the assumption was delayed with `from phase N`.
 */
export interface Assumption {
	Term: string;
	Capability: string;
	FromPhase: number;
}

export interface VerifyResult {
	Query: string;
	Resolved: boolean;
	Summary: string;
	Constants: string[];
	/**
	 * Every assumption declared anywhere in the model, repeated on each
	 * result. Older Verifpal releases omit the key entirely, so treat it as
	 * optional and default to an empty list.
	 */
	Assumptions?: Assumption[];
}

export function describeAssumption(a: Assumption): string {
	const when = a.FromPhase > 0 ? ` from phase ${a.FromPhase}` : "";
	return `${a.Term} — ${a.Capability}${when}`;
}

export interface ConstantInfo {
	Name: string;
	Creator: string;
	Assigned: string;
	KnownBy: { recipient: string; sender: string }[];
	Phases: number[];
}

/**
 * Verifpal's default. `internal-json` has no sessions flag, so every analysis
 * the extension runs uses it, and a passing query means no attack was found
 * *within this many sessions per principal* rather than in general.
 */
export const DEFAULT_SESSIONS = 2;

/**
 * Parsing and validating a model is cheap and happens while the user types,
 * so it gets a ceiling; a full analysis does not, and is cancellable instead.
 */
const PARSE_TIMEOUT_MS = 15000;

async function internalJson(
	subcommand: string,
	fileContents: string,
	options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<string> {
	const result = await runVerifpal({
		binary: configDeterminePath(),
		args: ["internal-json", subcommand],
		input: fileContents,
		timeoutMs: options.timeoutMs,
		signal: options.signal
	});
	return result.stdout;
}

function parsePayload<T>(subcommand: string, stdout: string): T {
	const payload = extractJson(stdout);
	if (payload === undefined) {
		throw new VerifpalRunError(
			"exit",
			`Verifpal returned no JSON for '${subcommand}'. Is the binary a supported release?`,
			{ stdout }
		);
	}
	return payload as T;
}

export async function getKnowledgeMap(
	fileContents: string,
	signal?: AbortSignal
): Promise<KnowledgeMap> {
	const stdout = await internalJson("knowledgeMap", fileContents, {
		timeoutMs: PARSE_TIMEOUT_MS,
		signal
	});
	return parsePayload<KnowledgeMap>("knowledgeMap", stdout);
}

export async function getVerify(
	fileContents: string,
	signal?: AbortSignal
): Promise<VerifyResult[]> {
	const stdout = await internalJson("verify", fileContents, { signal });
	const results = parsePayload<VerifyResult[]>("verify", stdout);
	if (!Array.isArray(results)) {
		throw new VerifpalRunError("exit", "Verifpal returned an unexpected analysis payload.", { stdout });
	}
	return results;
}

export async function getPrettyPrint(
	fileContents: string,
	signal?: AbortSignal
): Promise<string> {
	const stdout = await internalJson("prettyPrint", fileContents, {
		timeoutMs: PARSE_TIMEOUT_MS,
		signal
	});
	return stripInfoLines(stdout);
}

export async function getPrettyDiagram(
	fileContents: string,
	signal?: AbortSignal
): Promise<string> {
	const stdout = await internalJson("prettyDiagram", fileContents, {
		timeoutMs: PARSE_TIMEOUT_MS,
		signal
	});
	return stripInfoLines(stdout);
}

/** Looks up everything the knowledge map records about one constant. */
export function constantInfo(name: string, km: KnowledgeMap): ConstantInfo | undefined {
	const lower = name.toLowerCase();
	const index = km.Constants.findIndex((c) => c.Name.toLowerCase() === lower);
	if (index < 0) {
		return undefined;
	}
	const knownBy: { recipient: string; sender: string }[] = [];
	for (const entry of km.KnownBy[index] ?? []) {
		for (const [recipient, sender] of Object.entries(entry)) {
			knownBy.push({ recipient, sender });
		}
	}
	return {
		Name: km.Constants[index].Name,
		Creator: km.Creator[index] ?? "",
		Assigned: km.Assigned[index] ?? "",
		KnownBy: knownBy,
		Phases: km.Phase[index] ?? []
	};
}

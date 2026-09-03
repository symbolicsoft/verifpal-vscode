/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import type { Range } from "vscode-languageclient";

export const ANALYSIS_REPORT = "verifpal/analysisReport";

export interface Assumption {
	term: string;
	capability: string;
	fromPhase: number;
}

export interface TraceStep {
	kind: string;
	text: string;
}

/**
 * Where a query sits in the model. `start` and `end` are byte offsets into
 * the UTF-8 text, as the engine's spans are; convert with
 * {@link indexOfByteOffset} before handing one to VS Code.
 */
export interface SourceRange {
	start: number;
	end: number;
	line: number;
	column: number;
}

export interface QueryReport {
	query: string;
	kind: string;
	resolved: boolean;
	range: SourceRange;
	summary: string;
	conclusion: string;
	steps: TraceStep[];
	preconditions: string[];
	variants: number;
}

export interface AnalysisReport {
	uri: string;
	version: number;
	/** The token the `verifpal.analyze` command answered with. Older servers leave it out. */
	token?: string;
	ok: boolean;
	cancelled: boolean;
	error?: string;
	model?: string;
	sessions?: number;
	code?: string;
	attacks?: number;
	elapsedMs?: number;
	assumptions?: Assumption[];
	queries?: QueryReport[];
}

export interface Accepted {
	accepted: boolean;
	token: string;
	/** Why the server declined, when it did. */
	reason?: string;
}

export interface DiagramResult {
	mermaid: string;
	readable: string;
}

export function describeAssumption(a: Assumption): string {
	const when = a.fromPhase > 0 ? ` from phase ${a.fromPhase}` : "";
	return `${a.term} — ${a.capability}${when}`;
}

/**
 * The index into `text`, in UTF-16 code units as VS Code counts, of the
 * character that starts at `byteOffset` in the text's UTF-8 encoding.
 *
 * The two agree on ASCII and drift apart on anything else: `→`, an accented
 * principal name or an emoji in a comment each shift every later position.
 * An offset that lands inside a multi-byte sequence is moved back to the
 * start of that character.
 */
export function indexOfByteOffset(text: string, byteOffset: number): number {
	const bytes = Buffer.from(text, "utf8");
	let end = Math.max(0, Math.min(byteOffset, bytes.length));
	while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
		end--;
	}
	return bytes.subarray(0, end).toString("utf8").length;
}

export type { Range };

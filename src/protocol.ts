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
}

export interface DiagramResult {
	mermaid: string;
	readable: string;
}

export function describeAssumption(a: Assumption): string {
	const when = a.fromPhase > 0 ? ` from phase ${a.fromPhase}` : "";
	return `${a.term} — ${a.capability}${when}`;
}

export type { Range };

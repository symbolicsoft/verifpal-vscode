/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

/**
 * Text handling: reading what Verifpal writes, and scanning what the user
 * wrote. Everything here is pure and free of any `vscode` import, so it is
 * unit-testable without an extension host; the providers are thin adapters
 * over these functions.
 */

import { lookupPrimitive } from "./spec";

/* eslint-disable no-control-regex */
const ANSI = /\x1b\[[0-9;]*m|\[[0-9;]+m/g;

/** Strips SGR escapes, including the bare `[0m` form Verifpal summaries carry. */
export function stripAnsi(text: string): string {
	return text.replace(ANSI, "");
}

/**
 * Pulls the JSON payload out of an `internal-json` invocation.
 *
 * Verifpal streams its analysis narrative (`Info ●`, `Analysis ▸`,
 * `Deduction ›`) to stdout ahead of the JSON, so the payload is the last line
 * that parses. Scanning from the end for a line that actually parses is what
 * makes this independent of how the narrative is worded or how many lines of
 * it there are.
 */
export function extractJson(stdout: string): unknown | undefined {
	const lines = stdout.split(/\r?\n/);
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (line.length === 0 || (line[0] !== "{" && line[0] !== "[")) {
			continue;
		}
		try {
			return JSON.parse(line);
		} catch {
			continue;
		}
	}
	return undefined;
}

/**
 * Verifpal's own status lines, as `info.rs` formats them: a right-aligned
 * label, a glyph, then the message.
 */
const INFO_LINE = /^\s*(?:Verifpal|Info|Analysis|Deduction|FAIL|PASS|Warning)\s+[\u25c6\u25cf\u25b8\u203a\u2717\u2713\u25b2]/;

/**
 * Drops any status lines Verifpal printed ahead of a text payload.
 *
 * `prettyPrint` and `prettyDiagram` emit nothing but their result today, but
 * they share an output channel with the rest of the engine, and a stray
 * status line prepended to formatter output would be written straight into
 * the user's model. Only *leading* lines are considered, and a line that
 * opens a comment is never one of them — that is what keeps a model whose
 * first line is `// Info ● …` from being mistaken for engine chatter.
 */
export function stripInfoLines(text: string): string {
	const lines = text.split(/\r?\n/);
	let start = 0;
	while (
		start < lines.length &&
		INFO_LINE.test(lines[start]) &&
		!/^\s*\/[/*]/.test(lines[start])
	) {
		start++;
	}
	return start === 0 ? text : lines.slice(start).join("\n");
}

/** A model error Verifpal reported, in the coordinates of the source text. */
export interface ModelError {
	/** Zero-based. */
	line: number;
	/** Zero-based. */
	column: number;
	/** How far the caret run extended, in characters; at least 1. */
	length: number;
	/** `parse`, `sanity`, `internal`, … — the word before "error". */
	kind: string;
	message: string;
}

const ERROR_HEAD = /^Error:\s+(?:.*?):(\d+):(\d+):\s+(?:(\w+)\s+)?error:\s*(.*)$/;

/**
 * Parses Verifpal's stderr into structured errors.
 *
 * The format is a header line carrying `file:line:col`, then the offending
 * source line re-indented to a fixed margin, then a run of carets under it.
 * The re-indentation means the caret *column* is not the document column — but
 * the caret *length* is the span's true width, and the header already gives the
 * real position, so the two together reconstruct the range exactly.
 */
export function parseModelErrors(stderr: string): ModelError[] {
	const lines = stripAnsi(stderr).split(/\r?\n/);
	const errors: ModelError[] = [];
	for (let i = 0; i < lines.length; i++) {
		const head = lines[i].match(ERROR_HEAD);
		if (!head) {
			continue;
		}
		const line = Math.max(0, parseInt(head[1], 10) - 1);
		const column = Math.max(0, parseInt(head[2], 10) - 1);
		let length = 1;
		for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
			const carets = lines[j].match(/\^+/);
			if (carets) {
				length = carets[0].length;
				break;
			}
		}
		errors.push({
			line,
			column,
			length,
			kind: head[3] ?? "model",
			message: head[4].trim()
		});
	}
	return errors;
}

/** A half-open span of a single line. */
export interface TextRange {
	line: number;
	start: number;
	end: number;
}

/**
 * The stretches of each line that are actually code.
 *
 * Highlighting a query or a constant inside a comment marks text that has no
 * bearing on the result, so every occurrence search runs over these spans
 * rather than over raw lines. Both comment forms Verifpal accepts are handled;
 * `/* *\/` nesting is not, which matches the engine's own lexer.
 */
export function codeSpans(text: string): TextRange[] {
	const spans: TextRange[] = [];
	const lines = text.split(/\r?\n/);
	let inBlock = false;
	for (let line = 0; line < lines.length; line++) {
		const src = lines[line];
		let cursor = 0;
		let spanStart = inBlock ? -1 : 0;
		while (cursor < src.length) {
			if (inBlock) {
				const close = src.indexOf("*/", cursor);
				if (close < 0) {
					cursor = src.length;
					break;
				}
				inBlock = false;
				cursor = close + 2;
				spanStart = cursor;
				continue;
			}
			const lineComment = src.indexOf("//", cursor);
			const blockComment = src.indexOf("/*", cursor);
			if (lineComment >= 0 && (blockComment < 0 || lineComment < blockComment)) {
				if (spanStart >= 0 && lineComment > spanStart) {
					spans.push({ line, start: spanStart, end: lineComment });
				}
				spanStart = -1;
				cursor = src.length;
				break;
			}
			if (blockComment >= 0) {
				if (spanStart >= 0 && blockComment > spanStart) {
					spans.push({ line, start: spanStart, end: blockComment });
				}
				spanStart = -1;
				inBlock = true;
				cursor = blockComment + 2;
				continue;
			}
			break;
		}
		if (spanStart >= 0 && spanStart < src.length) {
			spans.push({ line, start: spanStart, end: src.length });
		}
	}
	return spans;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchSpans(text: string, pattern: RegExp): TextRange[] {
	const lines = text.split(/\r?\n/);
	const found: TextRange[] = [];
	for (const span of codeSpans(text)) {
		const slice = lines[span.line].slice(span.start, span.end);
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(slice)) !== null) {
			if (match[0].length === 0) {
				pattern.lastIndex++;
				continue;
			}
			found.push({
				line: span.line,
				start: span.start + match.index,
				end: span.start + match.index + match[0].length
			});
		}
	}
	return found;
}

/**
 * Every place a query as Verifpal reports it appears in the model.
 *
 * Verifpal always spells a query back with `->` and single spaces, but the
 * model may have been written with `→` or with different spacing, so the
 * pattern is built to tolerate both rather than matching the reported string
 * literally. The trailing boundary keeps `confidentiality? m` from claiming
 * part of `confidentiality? mm`.
 */
export function findQueryOccurrences(text: string, query: string): TextRange[] {
	const pattern = escapeRegExp(query.trim())
		.replace(/\\?->/g, "(?:->|→)")
		.replace(/\s+/g, "\\s*");
	return searchSpans(text, new RegExp(`${pattern}(?![A-Za-z0-9_])`, "gi"));
}

/** Every standalone occurrence of a constant name, outside comments. */
export function findConstantOccurrences(text: string, constant: string): TextRange[] {
	if (!/^[A-Za-z0-9_]+$/.test(constant)) {
		return [];
	}
	return searchSpans(
		text,
		new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(constant)}(?![A-Za-z0-9_])`, "gi")
	);
}

export type ModelSymbolKind = "principal" | "message" | "phase" | "queries" | "query" | "value";

export interface ModelSymbol {
	kind: ModelSymbolKind;
	name: string;
	detail: string;
	startLine: number;
	endLine: number;
	/** Column range of the name on `startLine`, for the selection range. */
	nameStart: number;
	nameEnd: number;
	children: ModelSymbol[];
}

const PRINCIPAL_HEAD = /^\s*principal\s+([A-Za-z0-9_]+)\s*\[/i;
const PHASE_HEAD = /^\s*phase\s*\[\s*(\d+)\s*\]/i;
const QUERIES_HEAD = /^\s*queries\s*\[/i;
const MESSAGE = /^\s*([A-Za-z0-9_]+)\s*(?:->|→)\s*([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$/;
const DECLARATION = /^\s*(knows\s+(?:public|private|password)|generates|leaks)\s+(.+?)\s*$/i;
const ASSIGNMENT = /^\s*([A-Za-z0-9_,\s]+?)\s*=\s*(.+?)\s*$/;

function blankCode(line: string): boolean {
	return line.trim().length === 0;
}

/**
 * A structural outline of the model: principals with the values they bind,
 * messages, phases, and the query block. Purely lexical, so it keeps working
 * on a model that does not yet parse — which is exactly when an outline is
 * most useful.
 */
export function scanModelSymbols(text: string): ModelSymbol[] {
	const raw = text.split(/\r?\n/);
	const spansByLine = new Map<number, TextRange[]>();
	for (const span of codeSpans(text)) {
		const list = spansByLine.get(span.line) ?? [];
		list.push(span);
		spansByLine.set(span.line, list);
	}
	const codeOf = (line: number): string => {
		const spans = spansByLine.get(line);
		if (!spans) {
			return "";
		}
		let out = "";
		let cursor = 0;
		for (const span of spans) {
			out += " ".repeat(Math.max(0, span.start - cursor));
			out += raw[line].slice(span.start, span.end);
			cursor = span.end;
		}
		return out;
	};

	const symbols: ModelSymbol[] = [];
	let open: ModelSymbol | undefined;
	let depth = 0;

	for (let line = 0; line < raw.length; line++) {
		const src = codeOf(line);
		if (blankCode(src)) {
			continue;
		}

		if (open) {
			for (const c of src) {
				if (c === "[") {
					depth++;
				} else if (c === "]") {
					depth--;
				}
			}
			open.endLine = line;
			if (depth <= 0) {
				open = undefined;
				depth = 0;
				continue;
			}
			addBlockChild(open, src, line);
			continue;
		}

		const principal = src.match(PRINCIPAL_HEAD);
		if (principal) {
			const nameStart = src.indexOf(principal[1], src.toLowerCase().indexOf("principal"));
			open = {
				kind: "principal",
				name: principal[1],
				detail: "principal",
				startLine: line,
				endLine: line,
				nameStart,
				nameEnd: nameStart + principal[1].length,
				children: []
			};
			symbols.push(open);
			depth = 0;
			for (const c of src) {
				if (c === "[") {
					depth++;
				} else if (c === "]") {
					depth--;
				}
			}
			if (depth <= 0) {
				open = undefined;
				depth = 0;
			}
			continue;
		}

		const queries = src.match(QUERIES_HEAD);
		if (queries) {
			open = {
				kind: "queries",
				name: "queries",
				detail: "",
				startLine: line,
				endLine: line,
				nameStart: src.toLowerCase().indexOf("queries"),
				nameEnd: src.toLowerCase().indexOf("queries") + "queries".length,
				children: []
			};
			symbols.push(open);
			depth = 0;
			for (const c of src) {
				if (c === "[") {
					depth++;
				} else if (c === "]") {
					depth--;
				}
			}
			if (depth <= 0) {
				open = undefined;
				depth = 0;
			}
			continue;
		}

		const phase = src.match(PHASE_HEAD);
		if (phase) {
			symbols.push({
				kind: "phase",
				name: `phase[${phase[1]}]`,
				detail: "",
				startLine: line,
				endLine: line,
				nameStart: src.toLowerCase().indexOf("phase"),
				nameEnd: src.length,
				children: []
			});
			continue;
		}

		const message = src.match(MESSAGE);
		if (message) {
			symbols.push({
				kind: "message",
				name: `${message[1]} → ${message[2]}`,
				detail: message[3],
				startLine: line,
				endLine: line,
				nameStart: src.indexOf(message[1]),
				nameEnd: src.length,
				children: []
			});
		}
	}

	return symbols;
}

function addBlockChild(parent: ModelSymbol, src: string, line: number): void {
	if (parent.kind === "queries") {
		const trimmed = src.trim();
		if (trimmed === "]" || trimmed.length === 0) {
			return;
		}
		parent.children.push({
			kind: "query",
			name: trimmed,
			detail: "",
			startLine: line,
			endLine: line,
			nameStart: src.indexOf(trimmed),
			nameEnd: src.indexOf(trimmed) + trimmed.length,
			children: []
		});
		return;
	}

	const declaration = src.match(DECLARATION);
	if (declaration) {
		for (const name of splitNames(declaration[2])) {
			pushValue(parent, src, line, name, declaration[1].toLowerCase().replace(/\s+/g, " "));
		}
		return;
	}
	const assignment = src.match(ASSIGNMENT);
	if (assignment) {
		for (const name of splitNames(assignment[1])) {
			pushValue(parent, src, line, name, assignment[2]);
		}
	}
}

function splitNames(list: string): string[] {
	return list
		.split(",")
		.map((s) => s.trim())
		.filter((s) => /^[A-Za-z0-9_]+$/.test(s));
}

function pushValue(parent: ModelSymbol, src: string, line: number, name: string, detail: string): void {
	const start = src.indexOf(name);
	parent.children.push({
		kind: "value",
		name,
		detail,
		startLine: line,
		endLine: line,
		nameStart: start < 0 ? 0 : start,
		nameEnd: start < 0 ? src.length : start + name.length,
		children: []
	});
}

/** Where in a model a given offset sits, used to scope completions. */
export type ModelContext = "top" | "principal" | "queries" | "capability" | "arguments";

/**
 * Classifies the cursor position well enough to offer the right completions.
 *
 * This is a lexical approximation rather than a parse: it walks the text
 * before the cursor tracking which block it is inside, then looks at the
 * immediate prefix to see whether the cursor sits in a primitive's capability
 * brackets or its argument list.
 */
export function contextAt(text: string, offset: number): ModelContext {
	const before = text.slice(0, offset);
	const raw = before.split(/\r?\n/);
	const lines = raw.map(() => "");
	for (const span of codeSpans(before)) {
		lines[span.line] += raw[span.line].slice(span.start, span.end);
	}
	const code = lines.join("\n");
	const linePrefix = lines[lines.length - 1] ?? "";

	// An open bracket is a capability annotation only when the name in front
	// of it is a primitive: `principal Alice[` and `queries[` have the same
	// shape, and a query option block such as `m[ precondition[` has it twice.
	const opener = linePrefix.match(/([A-Za-z][A-Za-z0-9_]*)\s*\[[^\]]*$/);
	if (opener && lookupPrimitive(opener[1])) {
		return "capability";
	}
	let parens = 0;
	for (const c of linePrefix) {
		if (c === "(") {
			parens++;
		} else if (c === ")") {
			parens--;
		}
	}
	if (parens > 0) {
		return "arguments";
	}

	let block: ModelContext = "top";
	let depth = 0;
	const tokens = code.match(/\bprincipal\b|\bqueries\b|\[|\]/gi) ?? [];
	let pending: ModelContext | undefined;
	for (const token of tokens) {
		const lower = token.toLowerCase();
		if (lower === "principal") {
			pending = "principal";
		} else if (lower === "queries") {
			pending = "queries";
		} else if (token === "[") {
			depth++;
			if (depth === 1 && pending) {
				block = pending;
			}
			pending = undefined;
		} else if (token === "]") {
			depth--;
			if (depth <= 0) {
				depth = 0;
				block = "top";
			}
		}
	}
	return block;
}

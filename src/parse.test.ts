/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	codeSpans,
	contextAt,
	extractJson,
	findConstantOccurrences,
	findQueryOccurrences,
	parseModelErrors,
	scanModelSymbols,
	stripAnsi,
	stripInfoLines
} from "./parse";

/**
 * Captured from `verifpal internal-json verify` on Verifpal 1.0.4: the
 * analysis narrative goes to stdout ahead of the JSON, which is what
 * `extractJson` has to see past.
 */
const VERIFY_STDOUT = [
	"     Info ● Analyzing 2 parallel sessions per principal; per-session values and principals are suffixed #2.",
	"     Info ● Attacker is configured as active.",
	"     Info ● Running at phase 0.",
	" Analysis ▸ Constructed skeleton DH_KEX(PUBKEY(nil), nil) based on DH_KEX(PUBKEY(a), b).",
	"Deduction › Output of AEAD_ENC(DH_KEX(PUBKEY(nil), nil), nil, nil) obtained by decomposing.",
	"[{\"Query\":\"confidentiality? m\",\"Resolved\":false,\"Summary\":\"\",\"Constants\":[\"m\"],\"Assumptions\":[]}]"
].join("\n");

/** Captured from stderr on a model that fails sanity checking. */
const SANITY_STDERR = [
	"Error: editor.vp:12:2: sanity error: Bob is using constant (m) despite not knowing it",
	"   e = AEAD_ENC(k, m, nil)",
	"   ^^^^^^^^^^^^^^^^^^^^^^^",
	""
].join("\n");

describe("stripAnsi", () => {
	it("removes both escaped and bare SGR sequences", () => {
		assert.equal(stripAnsi("[31mred[0m"), "red");
		assert.equal(stripAnsi("[1mbold[0m"), "bold");
	});

	it("leaves guarded message brackets alone", () => {
		assert.equal(stripAnsi("Alice -> Bob: [ga], e"), "Alice -> Bob: [ga], e");
	});
});

describe("extractJson", () => {
	it("finds the payload past the analysis narrative", () => {
		const payload = extractJson(VERIFY_STDOUT) as { Query: string }[];
		assert.equal(payload.length, 1);
		assert.equal(payload[0].Query, "confidentiality? m");
	});

	it("handles a payload that is the only line", () => {
		assert.deepEqual(extractJson("{\"MaxPhase\":0}"), { MaxPhase: 0 });
	});

	it("tolerates a trailing newline", () => {
		assert.deepEqual(extractJson("[1,2]\n"), [1, 2]);
	});

	it("reports nothing rather than throwing when there is no payload", () => {
		assert.equal(extractJson("     Info ● nothing to say"), undefined);
		assert.equal(extractJson(""), undefined);
	});
});

describe("stripInfoLines", () => {
	it("drops leading engine status lines", () => {
		const out = stripInfoLines("     Info ● Attacker is configured as active.\nattacker[active]\n");
		assert.equal(out, "attacker[active]\n");
	});

	it("leaves a model that starts with a comment alone, even a suspicious one", () => {
		const model = "// Info ● this is a comment, not engine output\nattacker[active]\n";
		assert.equal(stripInfoLines(model), model);
		const block = "/* Info ● still a comment */\nattacker[active]\n";
		assert.equal(stripInfoLines(block), block);
	});

	it("leaves ordinary formatter output untouched", () => {
		const model = "attacker[active]\n\nprincipal Alice[\n\tknows private m\n]\n";
		assert.equal(stripInfoLines(model), model);
	});

	it("only considers leading lines", () => {
		const model = "attacker[active]\n     Info ● not stripped from the middle\n";
		assert.equal(stripInfoLines(model), model);
	});
});

describe("parseModelErrors", () => {
	it("reconstructs the span from the header position and the caret run", () => {
		const errors = parseModelErrors(SANITY_STDERR);
		assert.equal(errors.length, 1);
		const [error] = errors;
		assert.equal(error.line, 11, "line is zero-based");
		assert.equal(error.column, 1, "column is zero-based");
		assert.equal(error.length, "e = AEAD_ENC(k, m, nil)".length);
		assert.equal(error.kind, "sanity");
		assert.equal(error.message, "Bob is using constant (m) despite not knowing it");
	});

	it("reads a parse error with a single-character caret", () => {
		const errors = parseModelErrors(
			"Error: editor.vp:5:1: internal error: unknown primitive\n  ]\n  ^\n"
		);
		assert.equal(errors.length, 1);
		assert.equal(errors[0].length, 1);
		assert.equal(errors[0].kind, "internal");
	});

	it("defaults to a one-character span when no caret follows", () => {
		const errors = parseModelErrors("Error: editor.vp:2:3: parse error: unexpected token");
		assert.equal(errors[0].length, 1);
	});

	it("ignores unrelated output", () => {
		assert.deepEqual(parseModelErrors("     Info ● all is well"), []);
	});
});

describe("codeSpans", () => {
	it("excludes line comments", () => {
		assert.deepEqual(codeSpans("a = HASH(b) // note"), [{ line: 0, start: 0, end: 12 }]);
	});

	it("excludes block comments and resumes after them", () => {
		assert.deepEqual(codeSpans("/* x */ y"), [{ line: 0, start: 7, end: 9 }]);
	});

	it("carries an unterminated block comment across lines", () => {
		const spans = codeSpans("a /* start\nstill comment\nend */ b");
		assert.deepEqual(spans, [
			{ line: 0, start: 0, end: 2 },
			{ line: 2, start: 6, end: 8 }
		]);
	});
});

describe("findQueryOccurrences", () => {
	it("matches a query written with the Unicode arrow", () => {
		const text = "queries[\n\tauthentication? Alice → Bob: e\n]";
		const found = findQueryOccurrences(text, "authentication? Alice -> Bob: e");
		assert.equal(found.length, 1);
		assert.equal(found[0].line, 1);
		assert.equal(found[0].start, 1);
	});

	it("does not claim part of a longer constant name", () => {
		const text = "queries[\n\tconfidentiality? mm\n]";
		assert.deepEqual(findQueryOccurrences(text, "confidentiality? m"), []);
	});

	it("stops before a query option block", () => {
		const text = "queries[\n\tconfidentiality? m[ precondition[ Bob -> Alice: ack ] ]\n]";
		const found = findQueryOccurrences(text, "confidentiality? m");
		assert.equal(found.length, 1);
		assert.equal(found[0].end - found[0].start, "confidentiality? m".length);
	});

	it("skips a query mentioned in a comment", () => {
		const text = "// confidentiality? m\nqueries[\n\tconfidentiality? m\n]";
		const found = findQueryOccurrences(text, "confidentiality? m");
		assert.equal(found.length, 1);
		assert.equal(found[0].line, 2);
	});
});

describe("findConstantOccurrences", () => {
	it("finds a constant at the start of a line", () => {
		const found = findConstantOccurrences("m = HASH(x)", "m");
		assert.equal(found.length, 1);
		assert.equal(found[0].start, 0);
	});

	it("finds every occurrence on a line, not only the first", () => {
		assert.equal(findConstantOccurrences("x = HASH(m, m)", "m").length, 2);
	});

	it("does not match inside a longer identifier", () => {
		assert.deepEqual(findConstantOccurrences("mm = HASH(mx)", "m"), []);
	});

	it("ignores occurrences inside comments", () => {
		const found = findConstantOccurrences("e = ENC(k, m) // m is secret", "m");
		assert.equal(found.length, 1);
	});
});

describe("scanModelSymbols", () => {
	const model = [
		"attacker[active]",
		"",
		"principal Alice[",
		"\tknows private m",
		"\tgenerates a",
		"\tga = PUBKEY(a)",
		"]",
		"",
		"Alice -> Bob: [ga]",
		"",
		"phase[1]",
		"",
		"queries[",
		"\tconfidentiality? m",
		"\tauthentication? Alice -> Bob: ga",
		"]"
	].join("\n");

	it("finds the principal, the message, the phase and the query block", () => {
		const symbols = scanModelSymbols(model);
		assert.deepEqual(
			symbols.map((s) => s.kind),
			["principal", "message", "phase", "queries"]
		);
	});

	it("lists the values a principal binds", () => {
		const [principal] = scanModelSymbols(model);
		assert.deepEqual(principal.children.map((c) => c.name), ["m", "a", "ga"]);
		assert.equal(principal.children[2].detail, "PUBKEY(a)");
		assert.equal(principal.endLine, 6);
	});

	it("lists each query", () => {
		const queries = scanModelSymbols(model).find((s) => s.kind === "queries");
		assert.equal(queries?.children.length, 2);
	});

	it("still produces an outline for a model that does not parse", () => {
		const symbols = scanModelSymbols("principal Alice[\n\tga = PUBKEY(");
		assert.equal(symbols.length, 1);
		assert.equal(symbols[0].name, "Alice");
	});

	it("ignores commented-out declarations", () => {
		const [principal] = scanModelSymbols("principal Alice[\n\t// generates a\n\tgenerates b\n]");
		assert.deepEqual(principal.children.map((c) => c.name), ["b"]);
	});
});

describe("contextAt", () => {
	const at = (text: string): ReturnType<typeof contextAt> => contextAt(text, text.length);

	it("recognises the top level", () => {
		assert.equal(at("attacker[active]\n"), "top");
	});

	it("recognises a principal block", () => {
		assert.equal(at("principal Alice[\n\tknows private m\n\t"), "principal");
	});

	it("recognises the queries block", () => {
		assert.equal(at("principal Alice[\n]\nqueries[\n\t"), "queries");
	});

	it("recognises a primitive argument list", () => {
		assert.equal(at("principal Alice[\n\te = AEAD_ENC(k, "), "arguments");
	});

	it("recognises capability brackets", () => {
		assert.equal(at("principal Alice[\n\te = AEAD_ENC["), "capability");
	});

	it("leaves the top level after a block closes", () => {
		assert.equal(at("principal Alice[\n\tknows private m\n]\n"), "top");
	});
});

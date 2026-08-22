/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import * as fs from "fs";
import * as oniguruma from "vscode-oniguruma";
import * as textmate from "vscode-textmate";
import { SAMPLE_MODEL, manifest, repoPath, repoRead } from "../repo";

/**
 * Tokenizes the TextMate grammar with the same engine VS Code uses.
 *
 * Loading the grammar at all proves the plist is well formed, which nothing
 * else checks: VS Code logs a parse failure to a channel nobody reads and then
 * renders the file unhighlighted. The scope assertions then pin the styling
 * that themes key off, so that regenerating `verifpal.iro` cannot silently
 * recolour the language.
 */

const GRAMMAR_PATH = repoPath("syntax", "verifpal.tmLanguage");

interface Token {
	line: number;
	text: string;
	scopes: string[];
}

let grammar: textmate.IGrammar;

async function loadGrammar(): Promise<textmate.IGrammar> {
	const scopeName = manifest().contributes.grammars[0].scopeName;
	const wasm = fs.readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"));
	await oniguruma.loadWASM(
		wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)
	);
	const registry = new textmate.Registry({
		onigLib: Promise.resolve({
			createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns),
			createOnigString: (source: string) => new oniguruma.OnigString(source)
		}),
		loadGrammar: async (requested: string) => {
			if (requested !== scopeName) {
				return null;
			}
			return textmate.parseRawGrammar(repoRead("syntax", "verifpal.tmLanguage"), GRAMMAR_PATH);
		}
	});
	const loaded = await registry.loadGrammar(scopeName);
	assert.ok(loaded, `the grammar did not load under '${scopeName}': the plist is malformed`);
	return loaded;
}

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let stack = textmate.INITIAL;
	source.split(/\r?\n/).forEach((line, index) => {
		const result = grammar.tokenizeLine(line, stack);
		for (const token of result.tokens) {
			const text = line.substring(token.startIndex, token.endIndex);
			if (text.trim().length > 0) {
				tokens.push({ line: index, text, scopes: token.scopes });
			}
		}
		stack = result.ruleStack;
	});
	return tokens;
}

function first(tokens: Token[], text: string): Token {
	const token = tokens.find((candidate) => candidate.text.trim() === text);
	assert.ok(token, `no token with the text '${text}' was produced`);
	return token;
}

function assertScope(tokens: Token[], text: string, scope: string): void {
	const token = first(tokens, text);
	assert.ok(
		token.scopes.includes(scope),
		`'${text}' was scoped [${token.scopes.join(", ")}], expected it to include '${scope}'`
	);
}

describe("TextMate grammar declaration", () => {
	it("declares the scope name the manifest points at", () => {
		const declared = manifest().contributes.grammars[0].scopeName;
		const literal = declared.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		assert.match(
			repoRead("syntax", "verifpal.tmLanguage"),
			new RegExp(`<key>scopeName</key>\\s*<string>${literal}</string>`),
			`the grammar's own scopeName does not match the manifest's '${declared}'`
		);
	});

	it("claims the .vp file extension", () => {
		const plist = repoRead("syntax", "verifpal.tmLanguage");
		assert.match(plist, /<key>fileTypes<\/key>\s*<array>\s*<string>vp<\/string>/);
	});
});

describe("TextMate grammar tokenization", () => {
	let sample: Token[];

	before(async function () {
		this.timeout(20000);
		grammar = await loadGrammar();
		sample = tokenize(repoRead(SAMPLE_MODEL));
	});

	it("produces tokens for a realistic model", () => {
		assert.ok(sample.length > 50, `only ${sample.length} tokens came out of the fixture`);
	});

	it("scopes block keywords as entities", () => {
		for (const keyword of ["attacker", "principal", "phase", "queries"]) {
			assertScope(sample, keyword, "entity.name.function.verifpal");
		}
	});

	it("scopes principal names and message endpoints", () => {
		assertScope(sample, "Alice", "string.verifpal");
		assertScope(sample, "Bob", "string.verifpal");
	});

	it("scopes declaration keywords", () => {
		for (const keyword of ["knows", "generates", "leaks"]) {
			assertScope(sample, keyword, "markup.italic.verifpal");
		}
	});

	it("scopes knowledge qualifiers", () => {
		const tokens = tokenize(
			["principal Alice[", "\tknows private a", "\tknows public b", "\tknows password c", "]"].join(
				"\n"
			)
		);
		for (const qualifier of ["private", "public", "password"]) {
			assertScope(tokens, qualifier, "keyword.verifpal");
		}
	});

	it("scopes primitives, and does so case-insensitively", () => {
		for (const primitive of ["PUBKEY", "DH_KEX", "AEAD_ENC", "AEAD_DEC", "SIGN", "SIGNVERIF"]) {
			assertScope(sample, primitive, "support.function.verifpal");
		}
		const lowercase = tokenize("principal Alice[\n\tx = pubkey(a)\n]");
		assertScope(lowercase, "pubkey", "support.function.verifpal");
	});

	it("scopes nil and the unnamed binding as primitives", () => {
		assertScope(sample, "nil", "support.function.verifpal");
		assertScope(sample, "_", "support.function.verifpal");
	});

	it("scopes weakening assumptions only inside the annotation brackets", () => {
		const annotated = tokenize("principal Alice[\n\ty = PUBKEY[weak from phase 1](a)\n]");
		for (const word of ["weak", "from", "phase"]) {
			assertScope(annotated, word, "keyword.verifpal");
		}
		// `weak` is a legal constant name, so it must not be a keyword elsewhere.
		const constant = tokenize("principal Alice[\n\tknows private weak\n]");
		const token = first(constant, "weak");
		assert.ok(
			!token.scopes.includes("keyword.verifpal"),
			"a constant named 'weak' was styled as an assumption keyword"
		);
	});

	it("scopes query keywords", () => {
		for (const query of ["confidentiality?", "authentication?", "freshness?"]) {
			assertScope(sample, query, "markup.italic.verifpal");
		}
		const rest = tokenize("queries[\n\tunlinkability? a, b\n\tequivalence? a, b\n]");
		for (const query of ["unlinkability?", "equivalence?"]) {
			assertScope(rest, query, "markup.italic.verifpal");
		}
	});

	it("scopes line and block comments", () => {
		const comment = sample.find((token) => token.text.startsWith("//"));
		assert.ok(comment, "the fixture's line comment produced no token");
		assert.ok(comment.scopes.includes("comment.verifpal"));
		assertScope(sample, "/*", "comment.verifpal");
		assertScope(sample, "*/", "comment.verifpal");
	});

	it("scopes assignment targets as variables", () => {
		assertScope(sample, "ga", "variable.verifpal");
		assertScope(sample, "k_b", "variable.verifpal");
	});

	it("keeps every scope it emits inside its own namespace", () => {
		const scopes = new Set(sample.flatMap((token) => token.scopes));
		for (const scope of scopes) {
			assert.ok(
				scope.endsWith(".verifpal"),
				`the grammar emits '${scope}', which is not namespaced to this language`
			);
		}
	});
});

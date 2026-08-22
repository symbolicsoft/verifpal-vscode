/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import { manifest, repoPath, repoRead } from "../repo";
import * as fs from "fs";

/**
 * A malformed snippet file is dropped wholesale by VS Code, and a snippet with
 * a broken tab stop sequence lands the cursor somewhere surprising. Neither
 * shows up as a build failure, so they are checked here.
 */

interface Snippet {
	prefix: string;
	description: string;
	body: string[];
}

function snippets(): Record<string, Snippet> {
	const contribution = manifest().contributes.snippets.find(
		(entry) => entry.language === "verifpal"
	);
	assert.ok(contribution, "no snippets are contributed for verifpal");
	const file = repoPath(contribution.path.replace(/^\.\//, ""));
	assert.ok(fs.existsSync(file), `${contribution.path} is missing`);
	return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Snippet>;
}

/** Every tab stop index used in a body, `$0` included. */
function stops(body: string[]): number[] {
	return [...body.join("\n").matchAll(/\$\{?(\d+)/g)].map((match) => Number(match[1]));
}

describe("snippets", () => {
	const all = snippets();
	const entries = Object.entries(all);

	it("parses and is not empty", () => {
		assert.ok(entries.length > 0, "the snippet file contributes nothing");
	});

	it("gives every snippet a prefix, a description and a body", () => {
		for (const [name, snippet] of entries) {
			assert.strictEqual(typeof snippet.prefix, "string", `${name} has no prefix`);
			assert.ok(snippet.prefix.length > 0, `${name} has an empty prefix`);
			assert.ok(snippet.description?.length > 0, `${name} has no description`);
			assert.ok(Array.isArray(snippet.body), `${name} has a non-array body`);
			assert.ok(snippet.body.length > 0, `${name} has an empty body`);
			for (const line of snippet.body) {
				assert.strictEqual(typeof line, "string", `${name} has a non-string body line`);
			}
		}
	});

	it("uses a distinct prefix for each snippet", () => {
		const prefixes = entries.map(([, snippet]) => snippet.prefix);
		const duplicates = prefixes.filter((prefix, index) => prefixes.indexOf(prefix) !== index);
		assert.deepStrictEqual(duplicates, [], `duplicated snippet prefixes: ${duplicates.join(", ")}`);
	});

	it("uses lowercase, word-shaped prefixes", () => {
		for (const [name, snippet] of entries) {
			assert.match(snippet.prefix, /^[a-z][a-z0-9]*$/, `${name} has an odd prefix`);
		}
	});

	it("numbers tab stops contiguously from one", () => {
		for (const [name, snippet] of entries) {
			const used = [...new Set(stops(snippet.body))].filter((stop) => stop > 0).sort((a, b) => a - b);
			const expected = used.map((_, index) => index + 1);
			assert.deepStrictEqual(
				used,
				expected,
				`${name} skips a tab stop: it uses ${used.join(", ")}`
			);
		}
	});

	it("places at most one final cursor position", () => {
		for (const [name, snippet] of entries) {
			const finals = stops(snippet.body).filter((stop) => stop === 0);
			assert.ok(finals.length <= 1, `${name} declares $0 ${finals.length} times`);
		}
	});

	it("closes every choice list", () => {
		for (const [name, snippet] of entries) {
			const body = snippet.body.join("\n");
			for (const match of body.matchAll(/\$\{(\d+)\|/g)) {
				const rest = body.slice(match.index + match[0].length);
				assert.match(rest, /^[^|]*\|\}/, `${name} has an unterminated choice at $${match[1]}`);
			}
		}
	});

	it("indents with tabs, as the language configuration expects", () => {
		for (const [name, snippet] of entries) {
			for (const line of snippet.body) {
				assert.ok(!line.startsWith(" "), `${name} indents a line with spaces`);
			}
		}
	});

	it("only offers primitives the grammar knows about", () => {
		const grammar = repoRead("syntax", "verifpal.tmLanguage");
		const bodies = entries.map(([, snippet]) => snippet.body.join("\n")).join("\n");
		for (const match of bodies.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
			assert.ok(
				grammar.includes(match[1]),
				`snippets use the primitive '${match[1]}', which the grammar does not highlight`
			);
		}
	});
});

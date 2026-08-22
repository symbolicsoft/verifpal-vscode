/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CAPABILITIES,
	KEYWORDS,
	PRIMITIVES,
	QUERIES,
	lookupCapability,
	lookupKeyword,
	lookupPrimitive,
	lookupQuery,
	primitiveNotes,
	primitiveSignature
} from "./spec";

/**
 * These assertions pin this file against the engine's `src/primitive/spec.rs`
 * and `src/capability.rs`. They are not testing the extension so much as
 * testing that the extension still describes the Verifpal that ships: the
 * previous release documented `malleable` as unimplemented for a year after
 * `ENC[malleable]` started working, and nothing caught it.
 */
describe("primitive table", () => {
	it("covers all 25 primitives", () => {
		assert.equal(PRIMITIVES.length, 25);
	});

	it("names each primitive exactly once, in upper case", () => {
		const names = PRIMITIVES.map((p) => p.name);
		assert.equal(new Set(names).size, names.length);
		for (const name of names) {
			assert.equal(name, name.toUpperCase(), `${name} should be upper case`);
		}
	});

	it("lists exactly the checkable primitives", () => {
		assert.deepEqual(
			PRIMITIVES.filter((p) => p.checkable).map((p) => p.name).sort(),
			["ASSERT", "AEAD_DEC", "KEM_DECAP", "RINGSIGNVERIF", "SIGNVERIF", "SPLIT"].sort()
		);
	});

	it("lists exactly the primitives that accept each weakening assumption", () => {
		const accepting = (capability: string): string[] =>
			PRIMITIVES.filter((p) => (p.capabilities as string[]).includes(capability))
				.map((p) => p.name)
				.sort();
		assert.deepEqual(
			accepting("weak"),
			["AEAD_ENC", "ENC", "HASH", "KEM_ENCAP", "PKE_ENC", "PUBKEY", "PW_HASH"].sort()
		);
		assert.deepEqual(accepting("forgeable"), ["AEAD_ENC", "MAC", "RINGSIGN", "SIGN"].sort());
		// Only the unauthenticated cipher; an authenticated one is pointed at
		// `forgeable` by the engine instead.
		assert.deepEqual(accepting("malleable"), ["ENC"]);
	});

	it("gives every primitive an arity and output count the engine agrees with", () => {
		const expected: Record<string, [number[], number[]]> = {
			ASSERT: [[2], [1]],
			CONCAT: [[2, 3, 4, 5], [1]],
			SPLIT: [[1], [1, 2, 3, 4, 5]],
			HASH: [[1, 2, 3, 4, 5], [1]],
			PW_HASH: [[1, 2, 3, 4, 5], [1]],
			HKDF: [[3], [1, 2, 3, 4, 5]],
			MAC: [[2], [1]],
			ENC: [[2], [1]],
			DEC: [[2], [1]],
			AEAD_ENC: [[3], [1]],
			AEAD_DEC: [[3], [1]],
			PUBKEY: [[1], [1]],
			DH_KEX: [[2], [1]],
			KEM_ENCAP: [[2], [2]],
			KEM_DECAP: [[2], [1]],
			PKE_ENC: [[2], [1]],
			PKE_DEC: [[2], [1]],
			SIGN: [[2], [1]],
			SIGNVERIF: [[3], [1]],
			RINGSIGN: [[4], [1]],
			RINGSIGNVERIF: [[5], [1]],
			BLIND: [[2], [1]],
			UNBLIND: [[3], [1]],
			SHAMIR_SPLIT: [[1], [3]],
			SHAMIR_JOIN: [[2], [1]]
		};
		assert.deepEqual(PRIMITIVES.map((p) => p.name).sort(), Object.keys(expected).sort());
		for (const primitive of PRIMITIVES) {
			const [arity, outputs] = expected[primitive.name];
			assert.deepEqual(primitive.arity, arity, `${primitive.name} arity`);
			assert.deepEqual(primitive.outputs, outputs, `${primitive.name} outputs`);
		}
	});

	it("names enough arguments to satisfy the widest arity", () => {
		for (const primitive of PRIMITIVES) {
			const widest = primitive.arity[primitive.arity.length - 1];
			assert.ok(
				primitive.args.length >= widest,
				`${primitive.name} names ${primitive.args.length} arguments but accepts up to ${widest}`
			);
		}
	});

	it("documents every primitive", () => {
		for (const primitive of PRIMITIVES) {
			assert.ok(primitive.eg.length > 0, `${primitive.name} has no example`);
			assert.ok(primitive.help.length > 0, `${primitive.name} has no help text`);
		}
	});
});

describe("primitive rendering", () => {
	it("builds a signature from the narrowest arity", () => {
		assert.equal(primitiveSignature(lookupPrimitive("HKDF")!), "HKDF(salt, ikm, info)");
		assert.equal(primitiveSignature(lookupPrimitive("HASH")!), "HASH(value1)");
	});

	it("states the facts a call site needs", () => {
		assert.equal(primitiveNotes(lookupPrimitive("PUBKEY")!), "1 argument, 1 output; accepts [weak]");
		assert.equal(
			primitiveNotes(lookupPrimitive("AEAD_DEC")!),
			"3 arguments, 1 output; may be checked with `?`"
		);
		assert.equal(
			primitiveNotes(lookupPrimitive("SPLIT")!),
			"1 argument, 1–5 outputs; may be checked with `?`"
		);
		assert.equal(primitiveNotes(lookupPrimitive("KEM_ENCAP")!), "2 arguments, 2 outputs; accepts [weak]");
	});
});

describe("lookups", () => {
	it("resolves primitives case-insensitively, as the parser does", () => {
		assert.equal(lookupPrimitive("aead_enc")?.name, "AEAD_ENC");
		assert.equal(lookupPrimitive("AeAd_EnC")?.name, "AEAD_ENC");
		assert.equal(lookupPrimitive("NOT_A_PRIMITIVE"), undefined);
	});

	it("resolves the other vocabularies", () => {
		assert.equal(lookupCapability("MALLEABLE")?.name, "malleable");
		assert.equal(lookupQuery("Confidentiality")?.name, "confidentiality");
		assert.equal(lookupKeyword("GENERATES")?.name, "generates");
	});

	it("keeps the four vocabularies from colliding", () => {
		const names = [
			...PRIMITIVES.map((p) => p.name.toLowerCase()),
			...CAPABILITIES.map((c) => c.name),
			...QUERIES.map((q) => q.name),
			...KEYWORDS.map((k) => k.name)
		];
		assert.equal(new Set(names).size, names.length, "a term is documented in two tables");
	});

	it("documents every capability the engine defines, plus the phase delay", () => {
		assert.deepEqual(
			CAPABILITIES.map((c) => c.name).sort(),
			["forgeable", "from", "malleable", "weak"]
		);
	});

	it("documents every query kind the engine defines, plus the precondition option", () => {
		assert.deepEqual(
			QUERIES.map((q) => q.name).sort(),
			["authentication", "confidentiality", "equivalence", "freshness", "precondition", "unlinkability"]
		);
	});

	it("describes malleable as implemented", () => {
		const malleable = lookupCapability("malleable");
		assert.ok(malleable);
		assert.ok(
			!/no primitive currently declares it/i.test(malleable.help),
			"malleable is declared by ENC and has been since Verifpal 1.0"
		);
		assert.match(malleable.help, /ENC/);
	});
});

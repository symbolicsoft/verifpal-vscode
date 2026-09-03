/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import {
	ANALYSIS_REPORT,
	describeAssumption,
	indexOfByteOffset,
	type Assumption
} from "../../protocol";

/**
 * `protocol.ts` is the only module with no dependency on a running editor, so
 * it is exercised here rather than in the extension host.
 */

describe("protocol", () => {
	it("names the notification the language server sends", () => {
		assert.strictEqual(ANALYSIS_REPORT, "verifpal/analysisReport");
	});

	describe("describeAssumption", () => {
		const base: Assumption = { term: "PUBKEY", capability: "weak", fromPhase: 0 };

		it("omits the phase when the assumption holds from the start", () => {
			assert.strictEqual(describeAssumption(base), "PUBKEY — weak");
		});

		it("names the phase when the assumption comes into force later", () => {
			assert.strictEqual(
				describeAssumption({ ...base, fromPhase: 2 }),
				"PUBKEY — weak from phase 2"
			);
		});

		it("treats phase one as a later phase", () => {
			assert.strictEqual(
				describeAssumption({ ...base, fromPhase: 1 }),
				"PUBKEY — weak from phase 1"
			);
		});

		it("does not invent text for an empty capability", () => {
			assert.strictEqual(describeAssumption({ ...base, capability: "" }), "PUBKEY — ");
		});
	});

	describe("indexOfByteOffset", () => {
		it("is the identity on ASCII", () => {
			const text = "attacker[active]\nqueries[\n\tconfidentiality? m\n]\n";
			const at = text.indexOf("confidentiality");
			assert.strictEqual(indexOfByteOffset(text, at), at);
			assert.strictEqual(indexOfByteOffset(text, text.length), text.length);
		});

		it("counts a two-byte character once", () => {
			// `é` is two bytes in UTF-8 and one UTF-16 unit.
			const text = "principal Amélié[\n\tknows private m\n]\n";
			const byteOffset = Buffer.byteLength("principal Amélié[\n\t", "utf8");
			assert.strictEqual(indexOfByteOffset(text, byteOffset), "principal Amélié[\n\t".length);
		});

		it("counts the arrow and an emoji as the editor does", () => {
			// `→` is three bytes and one unit; the emoji is four bytes and two units.
			const text = "// 😀\nAlice → Bob: m\nqueries[\n\tconfidentiality? m\n]\n";
			const query = text.indexOf("confidentiality? m");
			const byteOffset = Buffer.byteLength(text.slice(0, query), "utf8");
			assert.notStrictEqual(byteOffset, query, "the fixture must exercise the conversion");
			assert.strictEqual(indexOfByteOffset(text, byteOffset), query);
			assert.strictEqual(
				indexOfByteOffset(text, byteOffset + "confidentiality? m".length),
				query + "confidentiality? m".length
			);
		});

		it("backs an offset inside a character up to its start", () => {
			assert.strictEqual(indexOfByteOffset("é", 1), 0);
		});

		it("clamps an offset outside the text", () => {
			assert.strictEqual(indexOfByteOffset("abc", 99), 3);
			assert.strictEqual(indexOfByteOffset("abc", -4), 0);
		});
	});
});

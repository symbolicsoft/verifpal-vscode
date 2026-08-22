/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import { ANALYSIS_REPORT, describeAssumption, type Assumption } from "../../protocol";

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
});

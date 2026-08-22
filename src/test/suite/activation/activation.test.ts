/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import * as vscode from "vscode";
import { SAMPLE_MODEL, extensionId, repoPath } from "../../repo";

/**
 * Runs in a VS Code instance of its own.
 *
 * The manifest declares no `activationEvents`; the extension relies on the
 * ones VS Code infers from its language and command contributions. That is
 * only observable while the extension is still dormant, and any test that
 * opens a model or runs a command wakes it, so this check cannot share an
 * instance with the rest of the suite.
 */

function extension(): vscode.Extension<unknown> {
	const found = vscode.extensions.getExtension(extensionId());
	assert.ok(found, `${extensionId()} is not installed in the test instance`);
	return found;
}

describe("implicit activation", () => {
	it("has not activated before anything asks it to", () => {
		assert.ok(
			!extension().isActive,
			"the extension was already active: this instance is not pristine"
		);
	});

	it("activates when a model is opened, with no command run first", async function () {
		this.timeout(30000);
		const document = await vscode.workspace.openTextDocument(repoPath(SAMPLE_MODEL));
		await vscode.window.showTextDocument(document);
		for (let attempt = 0; attempt < 100 && !extension().isActive; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		assert.ok(
			extension().isActive,
			"opening a .vp file did not activate the extension: check the language contribution"
		);
	});
});

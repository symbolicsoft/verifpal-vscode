/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import * as vscode from "vscode";
import { declaredCommands, extensionId, manifest } from "../repo";

/**
 * Runs inside a real VS Code. There is no `verifpal` binary on a CI runner, so
 * these also stand as the check that the extension comes up, and stays up,
 * when the language server cannot be spawned at all.
 */

function extension(): vscode.Extension<unknown> {
	const found = vscode.extensions.getExtension(extensionId());
	assert.ok(found, `${extensionId()} is not installed in the test instance`);
	return found;
}

describe("the extension", () => {
	it("is the one built from this repository", () => {
		const packaged = extension().packageJSON as { version: string; name: string };
		assert.strictEqual(packaged.version, manifest().version);
		assert.strictEqual(packaged.name, manifest().name);
	});

	it("activates without throwing when the verifpal binary is absent", async function () {
		this.timeout(30000);
		await extension().activate();
		assert.ok(extension().isActive);
	});

	it("registers every command it declares", async () => {
		await extension().activate();
		const registered = new Set(await vscode.commands.getCommands(true));
		for (const command of declaredCommands()) {
			assert.ok(registered.has(command), `'${command}' is declared but never registered`);
		}
	});

	it("registers no verifpal command it does not declare", async () => {
		await extension().activate();
		const declared = new Set(declaredCommands());
		const registered = (await vscode.commands.getCommands(true)).filter((command) =>
			command.startsWith("verifpal.")
		);
		for (const command of registered) {
			assert.ok(declared.has(command), `'${command}' is registered but not in the manifest`);
		}
	});

	it("runs its editor-independent commands without a language server", async function () {
		this.timeout(30000);
		await extension().activate();
		for (const command of ["verifpal.showOutput", "verifpal.clearResults", "verifpal.path"]) {
			await vscode.commands.executeCommand(command);
		}
	});

	it("can be restarted repeatedly", async function () {
		this.timeout(30000);
		await extension().activate();
		await vscode.commands.executeCommand("verifpal.restart");
		await vscode.commands.executeCommand("verifpal.restart");
		assert.ok(extension().isActive);
	});
});

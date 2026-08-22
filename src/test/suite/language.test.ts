/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import * as vscode from "vscode";
import { LANGUAGE_ID } from "../../config";
import { SAMPLE_MODEL, repoPath } from "../repo";

/**
 * Checks that the language, its file association and its language
 * configuration are all actually registered. A typo in any of them leaves the
 * extension loading cleanly and doing nothing.
 */

describe("the verifpal language", () => {
	it("is registered", async () => {
		const languages = await vscode.languages.getLanguages();
		assert.ok(languages.includes(LANGUAGE_ID), "verifpal is not a registered language");
	});

	it("claims files with a .vp extension", async () => {
		const document = await vscode.workspace.openTextDocument(repoPath(SAMPLE_MODEL));
		assert.strictEqual(document.languageId, LANGUAGE_ID);
	});

	it("can be set on an untitled document", async () => {
		const document = await vscode.workspace.openTextDocument({
			language: LANGUAGE_ID,
			content: "attacker[active]"
		});
		assert.strictEqual(document.languageId, LANGUAGE_ID);
	});

	it("comments with // , as the language configuration declares", async function () {
		this.timeout(20000);
		const document = await vscode.workspace.openTextDocument({
			language: LANGUAGE_ID,
			content: "attacker[active]"
		});
		const editor = await vscode.window.showTextDocument(document);
		editor.selection = new vscode.Selection(0, 0, 0, 0);
		await vscode.commands.executeCommand("editor.action.commentLine");
		assert.strictEqual(
			document.getText().trim(),
			"// attacker[active]",
			"the line comment token from language-configuration.json was not applied"
		);
	});

	it("blocks-comments with /* */, as the language configuration declares", async function () {
		this.timeout(20000);
		const document = await vscode.workspace.openTextDocument({
			language: LANGUAGE_ID,
			content: "attacker[active]"
		});
		const editor = await vscode.window.showTextDocument(document);
		editor.selection = new vscode.Selection(0, 0, 0, 16);
		await vscode.commands.executeCommand("editor.action.blockComment");
		assert.match(document.getText(), /\/\*.*attacker\[active\].*\*\//s);
	});
});

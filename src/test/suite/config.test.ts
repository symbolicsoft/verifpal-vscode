/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import * as vscode from "vscode";
import {
	LANGUAGE_ID,
	configDeterminePath,
	configGetAnalyzeOnSave,
	configGetEnabled,
	configGetPath,
	configGetSessions,
	isVerifpalDocument
} from "../../config";
import { SAMPLE_MODEL, manifest, repoPath } from "../repo";

/**
 * The accessors in `config.ts` decide which binary gets executed and whether a
 * command applies to the current document, so they are checked against a live
 * configuration rather than a stub.
 */

const GLOBAL = vscode.ConfigurationTarget.Global;

async function set(setting: string, value: unknown): Promise<void> {
	await vscode.workspace.getConfiguration().update(setting, value, GLOBAL);
}

/**
 * Clears only the settings a test actually wrote. Rewriting the whole section
 * would restart the language client once per setting, for nothing.
 */
async function reset(): Promise<void> {
	const configuration = vscode.workspace.getConfiguration();
	for (const setting of Object.keys(manifest().contributes.configuration.properties)) {
		if (configuration.inspect(setting)?.globalValue !== undefined) {
			await set(setting, undefined);
		}
	}
}

describe("configuration", () => {
	afterEach(async function () {
		this.timeout(20000);
		await reset();
	});

	it("reports the defaults the manifest declares", () => {
		const configuration = vscode.workspace.getConfiguration();
		for (const [setting, property] of Object.entries(
			manifest().contributes.configuration.properties
		)) {
			assert.deepStrictEqual(
				configuration.inspect(setting)?.defaultValue,
				property.default,
				`the running default for ${setting} is not the one in package.json`
			);
		}
	});

	it("reads the declared defaults through its own accessors", () => {
		assert.strictEqual(configGetEnabled(), true);
		assert.strictEqual(configGetPath(), "");
		assert.strictEqual(configGetAnalyzeOnSave(), false);
		assert.strictEqual(configGetSessions(), null);
	});

	it("trims a configured path", async () => {
		await set("verifpal.path", "  /opt/verifpal  ");
		assert.strictEqual(configGetPath(), "/opt/verifpal");
	});

	it("treats an unset session count as absent rather than zero", async () => {
		assert.strictEqual(configGetSessions(), null);
		await set("verifpal.sessions", 4);
		assert.strictEqual(configGetSessions(), 4);
		await set("verifpal.sessions", null);
		assert.strictEqual(configGetSessions(), null);
	});

	it("falls back to the PATH when no binary is configured", () => {
		assert.strictEqual(configDeterminePath(), "verifpal");
	});

	it("falls back to the PATH when the configured binary does not exist", async () => {
		await set("verifpal.path", repoPath("no", "such", "verifpal"));
		assert.strictEqual(configDeterminePath(), "verifpal");
	});

	it("uses the configured binary when it exists", async () => {
		// `process.execPath` is the one executable guaranteed to be present.
		await set("verifpal.path", process.execPath);
		assert.strictEqual(configDeterminePath(), process.execPath);
	});

	it("recognises a Verifpal document, and only a Verifpal document", async () => {
		const model = await vscode.workspace.openTextDocument(repoPath(SAMPLE_MODEL));
		assert.strictEqual(model.languageId, LANGUAGE_ID);
		assert.ok(isVerifpalDocument(model));

		const plain = await vscode.workspace.openTextDocument({
			language: "plaintext",
			content: "attacker[active]"
		});
		assert.ok(!isVerifpalDocument(plain));
		assert.ok(!isVerifpalDocument(undefined));
	});
});

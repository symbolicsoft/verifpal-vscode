/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import { configDeterminePath, configGetPath } from "./config";

const INSTALL_URL = "https://verifpal.com/";

let missingBinaryReported = false;

export function resetBinaryWarning(): void {
	missingBinaryReported = false;
}

/** Names the binary that was actually tried, which is not always the configured one. */
function describeAttempt(): string {
	const configured = configGetPath();
	const attempted = configDeterminePath();
	if (attempted === "verifpal") {
		return configured
			? `'verifpal' on your PATH, because the configured path '${configured}' does not exist`
			: "'verifpal' on your PATH";
	}
	return `the binary configured at '${attempted}'`;
}

export function reportMissingBinary(detail: string): void {
	if (missingBinaryReported) {
		return;
	}
	missingBinaryReported = true;
	void vscode.window
		.showErrorMessage(
			`Verifpal: could not start the language server using ${describeAttempt()}. ${detail} ` +
				"Install Verifpal 1.1 or newer, or set 'verifpal.path' to its location.",
			"Set Path…",
			"Install Verifpal"
		)
		.then((choice) => {
			if (choice === "Set Path…") {
				void vscode.commands.executeCommand("workbench.action.openSettings", "verifpal.path");
			} else if (choice === "Install Verifpal") {
				void vscode.env.openExternal(vscode.Uri.parse(INSTALL_URL));
			}
		});
}

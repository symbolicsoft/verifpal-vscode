/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import { configGetPath } from "./config";

const INSTALL_URL = "https://verifpal.com/";

let missingBinaryReported = false;

export function resetBinaryWarning(): void {
	missingBinaryReported = false;
}

export function reportMissingBinary(detail: string): void {
	if (missingBinaryReported) {
		return;
	}
	missingBinaryReported = true;
	const configured = configGetPath();
	const where = configured
		? `the binary configured at '${configured}'`
		: "'verifpal' on your PATH";
	void vscode.window
		.showErrorMessage(
			`Verifpal: could not start the language server using ${where}. ${detail} ` +
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

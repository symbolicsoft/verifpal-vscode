/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import { VerifpalRunError } from "./process";
import { configGetPath } from "./config";

const INSTALL_URL = "https://verifpal.com/";

let missingBinaryReported = false;

/**
 * Forgets that the "Verifpal not found" notice was shown.
 *
 * Called when `verifpal.path` changes: the user has just acted on the advice,
 * so the next failure is news again rather than a repeat.
 */
export function resetBinaryWarning(): void {
	missingBinaryReported = false;
}

/**
 * Reports a missing or unusable binary once, with somewhere to go next.
 *
 * The notice is rate-limited because validation runs while the user types: an
 * uninstalled Verifpal would otherwise produce a notification per keystroke
 * burst. Model errors are not handled here — those belong in the Problems
 * panel, where they can be pointed at the line that caused them.
 */
export function reportRunError(error: unknown, context: string): void {
	if (!(error instanceof VerifpalRunError)) {
		vscode.window.showErrorMessage(`Verifpal: ${context} failed. ${String(error)}`);
		return;
	}
	switch (error.failure) {
	case "cancelled":
		return;
	case "spawn": {
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
				`Verifpal: could not run ${where}. Install Verifpal, or set 'verifpal.path' to its location.`,
				"Set Path…",
				"Install Verifpal"
			)
			.then((choice) => {
				if (choice === "Set Path…") {
					void vscode.commands.executeCommand(
						"workbench.action.openSettings",
						"verifpal.path"
					);
				} else if (choice === "Install Verifpal") {
					void vscode.env.openExternal(vscode.Uri.parse(INSTALL_URL));
				}
			});
		return;
	}
	case "timeout":
		vscode.window.showErrorMessage(`Verifpal: ${context} timed out. ${error.message}`);
		return;
	case "exit":
		if (error.isModelError) {
			// Reported as a diagnostic on the offending line instead.
			return;
		}
		vscode.window.showErrorMessage(`Verifpal: ${context} failed. ${error.message}`);
	}
}

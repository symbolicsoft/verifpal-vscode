/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import * as fs from "fs";

export const LANGUAGE_ID = "verifpal";

function section(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration("verifpal");
}

export function configGetEnabled(): boolean {
	return section().get<boolean>("enabled") ?? true;
}

export function configGetPath(): string {
	return (section().get<string>("path") ?? "").trim();
}

/** Whether the model is re-validated as the user types, rather than only on demand. */
export function configGetValidateOnType(): boolean {
	return section().get<boolean>("validateOnType") ?? true;
}

/** Whether saving a model runs a full attacker analysis. Off by default: analysis can be slow. */
export function configGetAnalyzeOnSave(): boolean {
	return section().get<boolean>("analyzeOnSave") ?? false;
}

/**
 * The binary to invoke.
 *
 * An explicit path is honoured only if it exists, so a stale setting falls
 * back to PATH rather than failing every invocation with ENOENT.
 */
export function configDeterminePath(): string {
	const localInstall = configGetPath();
	if (localInstall) {
		try {
			if (fs.existsSync(localInstall)) {
				return localInstall;
			}
		} catch {
			// An unreadable path is no better than an absent one.
		}
	}
	return "verifpal";
}

/** True when `document` is a Verifpal model the extension should act on. */
export function isVerifpalDocument(document: vscode.TextDocument | undefined): boolean {
	return document?.languageId === LANGUAGE_ID;
}

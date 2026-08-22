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

export function configGetAnalyzeOnSave(): boolean {
	return section().get<boolean>("analyzeOnSave") ?? false;
}

export function configGetSessions(): number | null {
	const value = section().get<number | null>("sessions");
	return typeof value === "number" ? value : null;
}

export function configDeterminePath(): string {
	const localInstall = configGetPath();
	if (localInstall) {
		try {
			if (fs.existsSync(localInstall)) {
				return localInstall;
			}
		} catch {
			return "verifpal";
		}
	}
	return "verifpal";
}

export function isVerifpalDocument(document: vscode.TextDocument | undefined): boolean {
	return document?.languageId === LANGUAGE_ID;
}

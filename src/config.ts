/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import * as fs from "fs";

export function configGetEnabled(): boolean {
	return vscode.workspace.getConfiguration("verifpal").get<boolean>("enabled") ?? true;
}

export function configGetPath(): string {
	return vscode.workspace.getConfiguration("verifpal").get<string>("path") ?? "";
}

export function configDeterminePath(): string {
	const localInstall = configGetPath();
	if (localInstall && fs.existsSync(localInstall)) {
		return localInstall;
	}
	return "verifpal";
}

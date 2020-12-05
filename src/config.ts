/* SPDX-FileCopyrightText: © 2019-2021 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

/// <reference path="./cross-spawn.d.ts" />
import * as vscode from "vscode";
import * as fs from "fs";

export function configGetPath(): string {
	const config = vscode.workspace.getConfiguration("verifpal");
	if (config) {
		return config.get("path") || "";
	}
	return "";
}

export function configGetEnabled() {
	return vscode.workspace.getConfiguration("verifpal").get("enabled");
}

export function configDeterminePath() {
	let pathToVerifpal = "verifpal";
	const localInstall = configGetPath();
	if (fs.existsSync(localInstall)) {
		pathToVerifpal = localInstall;
	}
	return pathToVerifpal;
}
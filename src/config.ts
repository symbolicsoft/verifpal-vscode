/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const LANGUAGE_ID = "verifpal";

/** The bounds `verifpal.sessions` declares in the manifest. */
const MIN_SESSIONS = 1;
const MAX_SESSIONS = 16;

function section(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration("verifpal");
}

export function configGetEnabled(): boolean {
	return section().get<boolean>("enabled") ?? true;
}

/**
 * The configured binary path, trimmed, with a leading `~` expanded to the
 * home directory: the shell would have done that, and a path copied out of
 * one is the usual way this setting gets filled in.
 */
export function configGetPath(): string {
	const configured = (section().get<string>("path") ?? "").trim();
	if (configured === "~" || configured.startsWith("~/")) {
		return path.join(os.homedir(), configured.slice(1));
	}
	return configured;
}

export function configGetAnalyzeOnSave(): boolean {
	return section().get<boolean>("analyzeOnSave") ?? false;
}

/**
 * The session count to ask for, or `null` to leave the engine's default in
 * force. The server takes a whole number in a fixed range; a value outside it
 * is brought back in rather than sent as is and refused.
 */
export function configGetSessions(): number | null {
	const value = section().get<number | null>("sessions");
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return null;
	}
	return Math.min(MAX_SESSIONS, Math.max(MIN_SESSIONS, Math.round(value)));
}

/** Whether the configured path names a file that exists. */
function configuredPathExists(configured: string): boolean {
	try {
		return fs.existsSync(configured);
	} catch {
		return false;
	}
}

/**
 * The command that starts the language server: the configured binary when it
 * exists, otherwise `verifpal` from the PATH.
 */
export function configDeterminePath(): string {
	const localInstall = configGetPath();
	if (localInstall && configuredPathExists(localInstall)) {
		return localInstall;
	}
	return "verifpal";
}

/**
 * What is wrong with `verifpal.path`, if anything: a configured path that
 * does not exist is silently replaced by the PATH binary, which may be a
 * different Verifpal altogether, so the user is told.
 */
export function configPathProblem(): string | undefined {
	const configured = configGetPath();
	if (!configured || configuredPathExists(configured)) {
		return undefined;
	}
	return (
		`Verifpal: 'verifpal.path' is set to '${configured}', which does not exist. ` +
		"Using 'verifpal' from your PATH instead."
	);
}

export function isVerifpalDocument(document: vscode.TextDocument | undefined): boolean {
	return document?.languageId === LANGUAGE_ID;
}

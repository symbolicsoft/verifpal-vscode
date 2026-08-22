/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import { getPrettyPrint } from "./VerifpalLib";
import { VerifpalRunError } from "./process";
import { reportRunError } from "./binary";

/**
 * Formatting via Verifpal's own `prettyPrint`, so the editor and the CLI
 * agree byte for byte on what canonical form is.
 */
export default class FormattingProvider implements vscode.DocumentFormattingEditProvider {
	async provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		_options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): Promise<vscode.TextEdit[]> {
		const abort = new AbortController();
		token.onCancellationRequested(() => abort.abort());
		const original = document.getText();
		let formatted: string;
		try {
			formatted = await getPrettyPrint(original, abort.signal);
		} catch (error) {
			if (error instanceof VerifpalRunError && error.isModelError) {
				vscode.window.showErrorMessage(
					"Verifpal: cannot format a model that does not parse. See the Problems panel."
				);
			} else {
				reportRunError(error, "formatting");
			}
			return [];
		}
		if (token.isCancellationRequested || formatted.length === 0 || formatted === original) {
			return [];
		}
		return [minimalEdit(document, original, formatted)];
	}
}

/**
 * Replaces only the stretch that actually differs.
 *
 * Rewriting the whole document would work, but it collapses every fold, moves
 * the cursor to the top, and makes the change unreadable in a diff view.
 * Trimming the common prefix and suffix keeps a reformat of one line looking
 * like a reformat of one line.
 */
export function minimalEdit(
	document: vscode.TextDocument,
	original: string,
	formatted: string
): vscode.TextEdit {
	let start = 0;
	const limit = Math.min(original.length, formatted.length);
	while (start < limit && original[start] === formatted[start]) {
		start++;
	}
	let back = 0;
	while (
		back < limit - start &&
		original[original.length - 1 - back] === formatted[formatted.length - 1 - back]
	) {
		back++;
	}
	const range = new vscode.Range(
		document.positionAt(start),
		document.positionAt(original.length - back)
	);
	return vscode.TextEdit.replace(range, formatted.slice(start, formatted.length - back));
}

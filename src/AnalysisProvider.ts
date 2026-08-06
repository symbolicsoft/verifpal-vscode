/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import VerifpalLib, { describeAssumption } from "./VerifpalLib";
import type { Assumption, VerifyResult } from "./VerifpalLib";

let analysisActive = false;

let greenDecoration: vscode.TextEditorDecorationType;
let redDecoration: vscode.TextEditorDecorationType;
let analysisOutput: vscode.OutputChannel;

export function initAnalysisProvider(context: vscode.ExtensionContext): void {
	greenDecoration = vscode.window.createTextEditorDecorationType({
		border: "1px solid green",
		borderRadius: "3px",
		fontWeight: "bold"
	});
	redDecoration = vscode.window.createTextEditorDecorationType({
		border: "1px solid red",
		borderRadius: "3px",
		fontWeight: "bold"
	});
	analysisOutput = vscode.window.createOutputChannel("Verifpal Analysis");
	context.subscriptions.push(greenDecoration, redDecoration, analysisOutput);
}

/**
 * Every assumption declared in the model. Verifpal repeats the same list on
 * each result, so any one of them will do; take the first non-empty one.
 */
function collectAssumptions(parsedResults: VerifyResult[]): Assumption[] {
	for (const result of parsedResults) {
		if (result.Assumptions && result.Assumptions.length > 0) {
			return result.Assumptions;
		}
	}
	return [];
}

/**
 * A model that declares a weakening assumption is not being analyzed on its
 * own terms: an attack found under one is genuine only under that assumption,
 * and a clean result is conditional on it. Report them either way, so that
 * "Analysis complete" never reads as unconditional.
 */
function reportAssumptions(assumptions: Assumption[]): void {
	if (assumptions.length === 0) {
		return;
	}
	const plural = assumptions.length === 1 ? "" : "s";
	analysisOutput.appendLine(
		`Analysis performed under ${assumptions.length} declared weakening assumption${plural}:`
	);
	for (const assumption of assumptions) {
		analysisOutput.appendLine(`  ${describeAssumption(assumption)}`);
	}
	analysisOutput.appendLine("");
	vscode.window.showWarningMessage(
		`Verifpal: Results hold only under ${assumptions.length} declared weakening assumption${plural}. ` +
		"Check the Verifpal Analysis output pane for the list."
	);
}

function decorate(editor: vscode.TextEditor, parsedResults: VerifyResult[]): void {
	const fileContents = editor.document.getText();
	const passedQueries: vscode.DecorationOptions[] = [];
	const failedQueries: vscode.DecorationOptions[] = [];
	const fileContentsArray = fileContents.split("\n");
	for (const result of parsedResults) {
		if (result.Resolved) {
			analysisOutput.appendLine(`${result.Query}\n${result.Summary}`);
			vscode.window.showInformationMessage(
				`Verifpal: Query "${result.Query}" failed. Check the Verifpal Analysis output pane for more details.`
			);
		}
	}
	for (const result of parsedResults) {
		// Verifpal accepts "→" wherever it accepts "->", but always reports
		// queries back to us spelled with "->". Match either arrow so that a
		// model written with the Unicode form still gets decorated. Matching a
		// pattern rather than a normalized copy of the line keeps the offsets
		// below in the coordinates of the text actually on screen.
		const queryPattern = new RegExp(
			result.Query.toLowerCase()
				.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
				.replace(/->/g, "(?:->|→)")
		);
		for (let line = 0; line < fileContentsArray.length; line++) {
			const tl = fileContentsArray[line].toLowerCase();
			const queryMatch = tl.match(queryPattern);
			if (queryMatch !== null && queryMatch.index !== undefined) {
				const range = new vscode.Range(
					new vscode.Position(line, queryMatch.index),
					new vscode.Position(line, queryMatch.index + queryMatch[0].length)
				);
				if (result.Resolved) {
					failedQueries.push({ range });
				} else {
					passedQueries.push({ range });
				}
			}
			if (!result.Resolved) {
				continue;
			}
			for (const constantName of result.Constants) {
				const constMatch = tl.match(new RegExp(`(\\W)${constantName}(,|\\]|\\)|\\s|$)`));
				if (constMatch !== null && constMatch.index !== undefined) {
					const range = new vscode.Range(
						new vscode.Position(line, constMatch.index + 1),
						new vscode.Position(line, constMatch.index + 1 + constantName.length)
					);
					failedQueries.push({ range });
				}
			}
		}
	}
	editor.setDecorations(greenDecoration, passedQueries);
	editor.setDecorations(redDecoration, failedQueries);
}

export function verify(editor: vscode.TextEditor): void {
	if (analysisActive) {
		vscode.window.showErrorMessage("Verifpal: Analysis is already running.");
		return;
	}
	const fileContents = editor.document.getText();
	vscode.window.showInformationMessage("Verifpal: Running analysis...");
	analysisActive = true;
	VerifpalLib.getVerify(fileContents).then((result: string) => {
		analysisActive = false;
		result = result.split(/\r?\n/).pop() || "";
		const verifyResults: VerifyResult[] = JSON.parse(result);
		const parsedResults: VerifyResult[] = verifyResults.map((r) => ({
			Query: r.Query,
			Resolved: r.Resolved,
			Summary: r.Summary.replace(/\[(\d|;)+m/gm, ""),
			Constants: r.Constants,
			Assumptions: r.Assumptions ?? []
		}));
		vscode.window.showInformationMessage("Verifpal: Analysis complete.");
		reportAssumptions(collectAssumptions(parsedResults));
		decorate(editor, parsedResults);
	}).catch(() => {
		analysisActive = false;
		vscode.window.showErrorMessage(
			"Verifpal: Your model is invalid and cannot be analyzed or visualized. Check for syntax errors."
		);
	});
}

/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import VerifpalLib from "./VerifpalLib";
import type { VerifyResult } from "./VerifpalLib";

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
		for (let line = 0; line < fileContentsArray.length; line++) {
			const tl = fileContentsArray[line].toLowerCase();
			const tq = result.Query.toLowerCase();
			const queryIndex = tl.indexOf(tq);
			if (queryIndex >= 0) {
				const range = new vscode.Range(
					new vscode.Position(line, queryIndex),
					new vscode.Position(line, queryIndex + tq.length)
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
				const constMatch = tl.match(new RegExp(`(\\W)${constantName}(,|\\]|\\)|\\s|\\^|$)`));
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
			Constants: r.Constants
		}));
		vscode.window.showInformationMessage("Verifpal: Analysis complete.");
		decorate(editor, parsedResults);
	}).catch(() => {
		analysisActive = false;
		vscode.window.showErrorMessage(
			"Verifpal: Your model is invalid and cannot be analyzed or visualized. Check for syntax errors."
		);
	});
}

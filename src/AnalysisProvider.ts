/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from 'vscode';
import VerifpalLib from './VerifpalLib';

let analysisActive = false;
export default class AnalysisProvider {

	static greenDecoration = vscode.window.createTextEditorDecorationType({
		border: '1px solid green',
		borderRadius: '3px',
		fontWeight: 'bold'
	});

	static redDecoration = vscode.window.createTextEditorDecorationType({
		border: '1px solid red',
		borderRadius: '3px',
		fontWeight: 'bold'
	});

	static analysisOutput = vscode.window.createOutputChannel("Verifpal Analysis");

	static decorate(editor: vscode.TextEditor, parsedResults) {
		let fileContents = editor.document.getText();
		let passedQueries: vscode.DecorationOptions[] = [];
		let failedQueries: vscode.DecorationOptions[] = [];
		const fileContentsArray = fileContents.split('\n');
		for (let i = 0; i < parsedResults.length; i++) {
			if (parsedResults[i].Resolved) {
				this.analysisOutput.appendLine(`${parsedResults[i].Query}\n${parsedResults[i].Summary}`);
				vscode.window.showInformationMessage(`Verifpal: Query "${parsedResults[i].Query}" failed. Check the Verifpal Analysis output pane for more details.`);
			}
		}
		for (let i = 0; i < parsedResults.length; i++) {
			for (let line = 0; line < fileContentsArray.length; line++) {
				let tl = fileContentsArray[line].toLowerCase();
				let tq = parsedResults[i].Query.toLowerCase();
				let queryIndex = tl.indexOf(tq);
				if (queryIndex >= 0) {
					let range = new vscode.Range(
						new vscode.Position(line, queryIndex),
						new vscode.Position(line, queryIndex + tq.length)
					);
					if (parsedResults[i].Resolved) {
						failedQueries.push({
							range
						});
					} else {
						passedQueries.push({
							range
						});
					}
				}
				if (!parsedResults[i].Resolved) {
					continue
				}
				let constantNames = parsedResults[i].Constants;
				for (let ii = 0; ii < constantNames.length; ii++) {
					let constMatch = tl.match(`(\\W)${constantNames[ii]}(\\,|\\]|\\)|\\s|\\^|$)`);
					if (constMatch !== null && constMatch.index !== undefined) {
						let range = new vscode.Range(
							new vscode.Position(line, constMatch.index + 1),
							new vscode.Position(line, constMatch.index + 1 + constantNames[ii].length)
						);
						failedQueries.push({
							range
						});
					}
				}
			}
		}
		editor.setDecorations(AnalysisProvider.greenDecoration, passedQueries);
		editor.setDecorations(AnalysisProvider.redDecoration, failedQueries);
	}

	static verify(editor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
		if (analysisActive) {
			vscode.window.showInformationMessage(`Verifpal: Analysis is already running.`);
			return
		}
		let fileContents = editor.document.getText();
		vscode.window.showInformationMessage(`Verifpal: Running analysis...`);
		analysisActive = true;
		return VerifpalLib.getVerify(fileContents).then((result: string) => {
			analysisActive = false;
			result = result.split(/\r?\n/).pop() || '';
			const verifyResults = JSON.parse(result);
			const parsedResults: Object[] = [];
			for (let i = 0; i < verifyResults.length; i++) {
				let q = JSON.stringify(verifyResults[i].Query)
				VerifpalLib.getPrettyQuery(q).then((result: string) => {
					let constantNames: string[] = [];
					switch (verifyResults[i].Query.Kind) {
					case "confidentiality":
						for (let ii = 0; ii < verifyResults[i].Query.Constants.length; ii++) {
							constantNames.push(verifyResults[i].Query.Constants[ii].Name)
						}
						break;
					case "authentication":
						for (let ii = 0; ii < verifyResults[i].Query.Message.Constants.length; ii++) {
							constantNames.push(verifyResults[i].Query.Message.Constants[ii].Name)
						}
						break;
					case "freshness":
						for (let ii = 0; ii < verifyResults[i].Query.Constants.length; ii++) {
							constantNames.push(verifyResults[i].Query.Constants[ii].Name)
						}
						break;
					case "unlinkability":
						for (let ii = 0; ii < verifyResults[i].Query.Constants.length; ii++) {
							constantNames.push(verifyResults[i].Query.Constants[ii].Name)
						}
						break;
					}
					let formattedSummary = verifyResults[i].Summary.replace(/\[(\d|;)+m/gm, '');
					let p = {
						Query: result,
						Resolved: verifyResults[i].Resolved,
						Summary: formattedSummary,
						Constants: constantNames
					}
					parsedResults.push(p)
					if (parsedResults.length === verifyResults.length) {
						vscode.window.showInformationMessage(`Verifpal: Analysis complete.`);
						AnalysisProvider.decorate(editor, parsedResults);
					}
				});
			}
		});
	}
}
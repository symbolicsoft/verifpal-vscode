/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from 'vscode';
import VerifpalLib from './VerifpalLib';



export default class AnalysisProvider {

	static greenDecoration = vscode.window.createTextEditorDecorationType({
		border: '2px solid green',
		borderRadius: '3px'
	})

	static redDecoration = vscode.window.createTextEditorDecorationType({
		border: '2px solid red',
		borderRadius: '3px'
	})

	static decorate(editor: vscode.TextEditor, parsedResults) {
		let fileContents = editor.document.getText();
		let passedQueries: vscode.DecorationOptions[] = [];
		let failedQueries: vscode.DecorationOptions[] = [];
		const fileContentsArray = fileContents.split('\n');
		for (let i = 0; i < parsedResults.length; i++) {
			for (let line = 0; line < fileContentsArray.length; line++) {
				let tl = fileContentsArray[line].toLowerCase();
				let tq = parsedResults[i].Query.toLowerCase();
				let index = tl.indexOf(tq)
				if (index >= 0) {
					let range = new vscode.Range(
						new vscode.Position(line, index),
						new vscode.Position(line, index + tq.length)
					);
					if (parsedResults[i].Resolved) {
						failedQueries.push({ range });
					} else {
						passedQueries.push({ range });
					}
				}
			}
		}
		editor.setDecorations(AnalysisProvider.greenDecoration, passedQueries);
		editor.setDecorations(AnalysisProvider.redDecoration, failedQueries);
	}

	static verify(editor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
		let fileContents = editor.document.getText();
		vscode.window.showInformationMessage(`Verifpal: Running analysis...`);
		return VerifpalLib.getVerify(fileContents).then((result: string) => {
			result = result.split(/\r?\n/).pop() || '';
			const verifyResults = JSON.parse(result);
			const parsedResults: Object[] = [];
			for (let i = 0; i < verifyResults.length; i++) {
				let q = JSON.stringify(verifyResults[i].Query)
				VerifpalLib.getPrettyQuery(q).then((result: string) => {
					let p = {
						Query: result,
						Resolved: verifyResults[i].Resolved,
						Summary: verifyResults[i].Summary
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
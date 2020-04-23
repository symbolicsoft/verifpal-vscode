/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from 'vscode';
import VerifpalLib from './VerifpalLib';



export default class AnalysisDecorations {

	static decorationType = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'green',
		border: '2px solid white',
	})

	static decorate(editor: vscode.TextEditor) {
		let sourceCode = editor.document.getText()
		let regex = /(console\.log)/
		let decorationsArray: vscode.DecorationOptions[] = []
		const sourceCodeArr = sourceCode.split('\n')
		for (let line = 0; line < sourceCodeArr.length; line++) {
			let match = sourceCodeArr[line].match(regex)
			if (match !== null && match.index !== undefined) {
				let range = new vscode.Range(
					new vscode.Position(line, match.index),
					new vscode.Position(line, match.index + match[1].length)
				)
				let decoration = { range }
				decorationsArray.push(decoration)
			}
		}
		editor.setDecorations(AnalysisDecorations.decorationType, decorationsArray);
	}
}
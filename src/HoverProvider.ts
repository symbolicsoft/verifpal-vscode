/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from 'vscode';
import VerifpalLib from './VerifpalLib';

export default class HoverProvider {
	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken): Promise<any> {
		const wordPosition = document.getWordRangeAtPosition(position);
		if (!wordPosition) return new Promise((resolve) => resolve());
		const word = document.getText(wordPosition);
		return VerifpalLib.getTypeAtPos(
			document.getText(), document.uri.fsPath, position).then((typeAtPos: any) => {
				// const beautifiedData = beautify(typeAtPos.type, { indent_size: 4 });
				return new vscode.Hover([
					'Verifpal',
					{ language: 'javascriptreact', value: `${word}` }
				]);
			}).catch((e) => {

			});
	}
}
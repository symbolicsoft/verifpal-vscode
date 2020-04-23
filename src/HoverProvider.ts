/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from 'vscode';
import VerifpalLib from './VerifpalLib';
import {
	rejects
} from 'assert';
export default class HoverProvider {
	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken): Promise < any > {
		const wordPosition = document.getWordRangeAtPosition(position);
		if (!wordPosition) return new Promise((resolve) => resolve());
		const word = document.getText(wordPosition);
		const fileContents = document.getText();
		return VerifpalLib.getKnowledgeMap(fileContents).then((result: string) => {
			const knowledgeMap = JSON.parse(result.toString())
			let primitiveInfo = VerifpalLib.primitiveInfo(word);
			if (primitiveInfo.length > 0) {
				return new Promise((resolve, reject) => {
					resolve(new vscode.Hover([
						'Verifpal: Primitive Documentation', {
							language: 'verifpal',
							value: primitiveInfo
						}
					]))
				})
			} else {
				let info = VerifpalLib.constantInfo(word, knowledgeMap);
				if (!info.Valid) {
					return
				}
				return VerifpalLib.getPrettyValue(info.Assigned).then((result: string) => {
					let hoverText = `// Created by ${info.Creator}\n${result}`;
					return new Promise((resolve, reject) => {
						resolve(new vscode.Hover([
							'Verifpal: Constant Information', {
								language: 'verifpal',
								value: hoverText
							}
						]))
					})
				})
			}
		});
	}
}
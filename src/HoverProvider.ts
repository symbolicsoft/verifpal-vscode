/* SPDX-FileCopyrightText: © 2019-2021 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import VerifpalLib from "./VerifpalLib";
export default class HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position): Promise < any > {
		const wordPosition = document.getWordRangeAtPosition(position);
		if (!wordPosition) return new Promise((resolve) => resolve());
		const word = document.getText(wordPosition);
		const fileContents = document.getText();
		return VerifpalLib.getKnowledgeMap(fileContents).then((result: string) => {
			const knowledgeMap = JSON.parse(result.toString());
			let primitiveInfo = VerifpalLib.primitiveInfo(word);
			let queryInfo = VerifpalLib.queryInfo(word);
			if (primitiveInfo.length > 0) {
				return new Promise((resolve) => {
					resolve(new vscode.Hover([
						"Verifpal: Primitive Documentation", {
							language: "verifpal",
							value: primitiveInfo
						}
					]));
				});
			} else if (queryInfo.length > 0) {
				return new Promise((resolve) => {
					resolve(new vscode.Hover([
						"Verifpal: Query Documentation", {
							language: "verifpal",
							value: queryInfo
						}
					]));
				});
			} else {
				let info = VerifpalLib.constantInfo(word, knowledgeMap);
				if (!info.Valid) {
					return;
				}
				return VerifpalLib.getPrettyValue(info.Assigned).then((result: string) => {
					let hoverText = `// Created by ${info.Creator}\n${result}`;
					return new Promise((resolve) => {
						resolve(new vscode.Hover([
							"Verifpal: Constant Information", {
								language: "verifpal",
								value: hoverText
							}
						]));
					});
				});
			}
		});
	}
}
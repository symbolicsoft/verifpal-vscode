/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import VerifpalLib from "./VerifpalLib";
import type { KnowledgeMap } from "./VerifpalLib";

export default class HoverProvider implements vscode.HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
		const wordPosition = document.getWordRangeAtPosition(position);
		if (!wordPosition) {
			return undefined;
		}
		const word = document.getText(wordPosition);
		const fileContents = document.getText();
		return VerifpalLib.getKnowledgeMap(fileContents).then((result: string) => {
			const knowledgeMap: KnowledgeMap = JSON.parse(result);
			const primitiveInfo = VerifpalLib.primitiveInfo(word);
			const queryInfo = VerifpalLib.queryInfo(word);
			if (primitiveInfo.length > 0) {
				return new vscode.Hover([
					"Verifpal: Primitive Documentation",
					{ language: "verifpal", value: primitiveInfo }
				]);
			} else if (queryInfo.length > 0) {
				return new vscode.Hover([
					"Verifpal: Query Documentation",
					{ language: "verifpal", value: queryInfo }
				]);
			} else {
				const info = VerifpalLib.constantInfo(word, knowledgeMap);
				if (!info.Valid) {
					return undefined;
				}
				const hoverText = `// Created by ${info.Creator}\n${info.Assigned}`;
				return new vscode.Hover([
					"Verifpal: Constant Information",
					{ language: "verifpal", value: hoverText }
				]);
			}
		});
	}
}

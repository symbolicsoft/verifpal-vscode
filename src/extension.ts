/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import VerifpalLib from "./VerifpalLib";
import HoverProvider from "./HoverProvider";
import { initAnalysisProvider, verify } from "./AnalysisProvider";
import { createDiagramPanel, isDiagramActive, renderDiagram } from "./DiagramProvider";
import { configGetEnabled, configDeterminePath } from "./config";

export function activate(context: vscode.ExtensionContext): void {
	if (!configGetEnabled()) {
		return;
	}

	initAnalysisProvider(context);

	context.subscriptions.push(
		vscode.languages.registerHoverProvider("verifpal", new HoverProvider())
	);

	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider("verifpal", {
			provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
				const fileContents = document.getText();
				const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
				return VerifpalLib.getPrettyPrint(fileContents).then((result: string) => {
					return [vscode.TextEdit.replace(fullRange, result)];
				}).catch(() => {
					vscode.window.showErrorMessage("Verifpal: Formatting failed. Check for syntax errors.");
					return [];
				});
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("verifpal.showDiagram", (editor: vscode.TextEditor) => {
			createDiagramPanel(editor, context.extensionUri);
		})
	);

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
			if (isDiagramActive()) {
				const fileName = document.fileName;
				const fileContents = document.getText();
				renderDiagram(fileName, fileContents, context.extensionUri);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("verifpal.verify", verify)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("verifpal.path", () => {
			vscode.window.showInformationMessage(
				`Verifpal path set to '${configDeterminePath()}'`
			);
		})
	);
}

export function deactivate(): void {}

/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import VerifpalLib from "./VerifpalLib";
import HoverProvider from "./HoverProvider";
import AnalysisProvider from "./AnalysisProvider";
import DiagramProvider from "./DiagramProvider";
import {
	configGetEnabled,
	configDeterminePath
} from "./config";

export function activate(context: vscode.ExtensionContext) {
	if (!configGetEnabled()) {
		return false;
	}

	context.subscriptions.push(
		vscode.languages.registerHoverProvider([{
			language: "verifpal",
			scheme: "file",
			pattern: "**/*vp*"
		}], new HoverProvider())
	);

	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider("verifpal", {
			provideDocumentFormattingEdits(document: vscode.TextDocument) {
				let fileContents = document.getText();
				let fullRange = new vscode.Range(0, 0, document.lineCount, 0);
				return VerifpalLib.getPrettyPrint(fileContents).then((result: string) => {
					const edit = new vscode.WorkspaceEdit();
					edit.replace(document.uri, fullRange, result);
					return vscode.workspace.applyEdit(edit);
				});
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("verifpal.showDiagram", (editor: vscode.TextEditor) => {
			let fileName = editor.document.fileName;
			let fileContents = editor.document.getText();
			DiagramProvider.webviewPanel = vscode.window.createWebviewPanel(
				"verifpal",
				"Verifpal Protocol Diagram",
				vscode.ViewColumn.Beside, {
					enableScripts: true
				}
			);
			DiagramProvider.webviewPanel.onDidDispose(() => {
				DiagramProvider.diagramActive = false;
			});
			DiagramProvider.renderDiagram(fileName, fileContents, context.extensionPath);
		})
	);

	vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		if (DiagramProvider.diagramActive) {
			let fileName = document.fileName;
			let fileContents = document.getText();
			DiagramProvider.renderDiagram(fileName, fileContents, context.extensionPath);
		}
	});

	const showVerifpalPath = () => {
		vscode.window.showInformationMessage(
			`Verifpal path set to '${configDeterminePath()}'`
		);
	};

	vscode.commands.registerTextEditorCommand("verifpal.verify", AnalysisProvider.verify);
	vscode.commands.registerCommand("verifpal.path", showVerifpalPath);
}

export function deactivate() {}
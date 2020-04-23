/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from 'vscode';
import VerifpalLib from './VerifpalLib';
import HoverProvider from './HoverProvider';
import AnalysisProvider from './AnalysisProvider';
import {
	configGetEnabled,
	configDeterminePath
} from './config';

export function activate(context: vscode.ExtensionContext) {
	if (!configGetEnabled()) {
		return false;
	}

	context.subscriptions.push(
		vscode.languages.registerHoverProvider([{
			language: 'verifpal',
			scheme: 'file',
			pattern: '**/*vp*'
		}], new HoverProvider())
	);

	vscode.languages.registerDocumentFormattingEditProvider('verifpal', {
		provideDocumentFormattingEdits(document: vscode.TextDocument) {
			let fileContents = document.getText();
			let fullRange = new vscode.Range(0, 0, document.lineCount, 0);
			return VerifpalLib.getPrettyPrint(fileContents).then((result: string) => {
				const edit = new vscode.WorkspaceEdit();
				edit.replace(document.uri, fullRange, result);
				return vscode.workspace.applyEdit(edit);
			});
		}
	});

	vscode.workspace.onWillSaveTextDocument(event => {
		const openEditor = vscode.window.visibleTextEditors.filter(
			editor => editor.document.uri === event.document.uri
		)[0]
	});

	const showVerifpalPath = () => {
		vscode.window.showInformationMessage(
			`Verifpal path set to '${configDeterminePath()}'`
		);
	}

	vscode.commands.registerTextEditorCommand('verifpal.verify', AnalysisProvider.verify);
	vscode.commands.registerCommand('verifpal.path', showVerifpalPath);
}

export function deactivate() { }
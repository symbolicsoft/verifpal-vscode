/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import HoverProvider from './HoverProvider';
import CoverageProvider from './CoverageProvider';
import {
	configGetEnabled,
	configDeterminePath
} from './config';

'use strict';
import * as vscode from 'vscode';
import VerifpalLib from './VerifpalLib';
import { format } from 'url';

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

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand('verifpal.format', (editor, edit) => {
			let fileContents = editor.document.getText();
			let fullRange = new vscode.Range(0, 0, editor.document.lineCount, 0);
			return VerifpalLib.getPrettyPrint(fileContents).then((result: string) => {
				vscode.window.activeTextEditor!.edit((editBuilder) => {
					editBuilder.replace(fullRange, result);
				});
			});
		})
	);

	const coverage = new CoverageProvider(context.subscriptions);
	const refreshCoverage = () => {
		coverage.toggleDecorations();
		//coverage.refreshCoverage();
	};

	const showVerifpalPath = () => {
		vscode.window.showInformationMessage(`Verifpal path set to '${configDeterminePath()}'`);
	}

	vscode.commands.registerCommand('verifpal.coverage', refreshCoverage);
	vscode.commands.registerCommand('verifpal.path', showVerifpalPath);
}

export function deactivate() { }
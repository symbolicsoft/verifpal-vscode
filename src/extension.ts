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

export function activate(context: vscode.ExtensionContext) {
	if (!configGetEnabled()) {
		return false;
	}

	context.subscriptions.push(
		vscode.languages.registerHoverProvider([
				{
					language: 'verifpal',
					scheme: 'file',
					pattern: '**/*vp*'
				}
		], new HoverProvider())
	);

	const coverage = new CoverageProvider(context.subscriptions);
	const refreshCoverage = () => {
		coverage.toggleDecorations();
		coverage.refreshCoverage();
	};
	
	const showVerifpalPath = () => {
		vscode.window.showInformationMessage(`Verifpal path set to '${configDeterminePath()}'`);
	}

	vscode.commands.registerCommand('verifpal.coverage', refreshCoverage);
	vscode.commands.registerCommand('verifpal.path', showVerifpalPath);
}

export function deactivate() {}
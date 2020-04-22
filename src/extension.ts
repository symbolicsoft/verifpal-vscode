/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import HoverProvider from './HoverProvider';
import AutocompleteProvider from './AutocompleteProvider';
import CoverageProvider from './CoverageProvider';
import SignatureProvider from './SignatureProvider';
import DefinitionProvider from './DefinitionProvider';
import { setupDiagnostics } from './Diagnostics';
import { configGetEnabled, configDeterminePath } from './config';

'use strict';
import * as vscode from 'vscode';

const supportedLanguages = [
	"verifpal"
];

let paramHintsEnable = false;

export function activate(context: vscode.ExtensionContext) {
	if (!configGetEnabled()) {
		return false;
	}
	context.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider(
			[
				{ language: 'verifpal', scheme: 'file', pattern: '**/*vp*' }
			],
			new SignatureProvider(), '(', '.')
	);

	context.subscriptions.push(
		vscode.languages.registerHoverProvider([
			{ language: 'verifpal', scheme: 'file', pattern: '**/*vp*' }
		],
			new HoverProvider()));

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider([
			{ language: 'verifpal', scheme: 'file', pattern: '**/*vp*' }
		],
			new AutocompleteProvider(), '.'));

	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider([
			{ language: 'verifpal', scheme: 'file', pattern: '**/*vp*' }
		],
			new DefinitionProvider())
	);

	const coverage = new CoverageProvider(context.subscriptions);
	const refreshCoverage = () => {
		coverage.toggleDecorations();
		coverage.refreshCoverage();
	};
	const showVerifpalPath = () => {
		vscode.window.showInformationMessage(`Verifpal path set to: ${configGetEnabled()}`);
	}
	vscode.commands.registerCommand('verifpal.coverage', refreshCoverage);
	vscode.commands.registerCommand('verifpal.path', showVerifpalPath);
	setupDiagnostics(context.subscriptions);
}

export function deactivate() {
}
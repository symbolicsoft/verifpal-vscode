/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import AnalysisProvider from "./AnalysisProvider";
import CompletionProvider from "./CompletionProvider";
import DiagnosticsProvider from "./DiagnosticsProvider";
import DiagramProvider from "./DiagramProvider";
import FormattingProvider from "./FormattingProvider";
import HoverProvider from "./HoverProvider";
import ModelIndex from "./ModelIndex";
import SignatureProvider from "./SignatureProvider";
import SymbolProvider from "./SymbolProvider";
import { resetBinaryWarning } from "./binary";
import {
	LANGUAGE_ID,
	configDeterminePath,
	configGetAnalyzeOnSave,
	configGetEnabled,
	isVerifpalDocument
} from "./config";

/**
 * Everything that exists only while the extension is enabled.
 *
 * Keeping it in one object is what lets `verifpal.enabled` take effect
 * immediately: flipping it disposes or rebuilds this, rather than requiring a
 * window reload as it used to.
 */
class Session implements vscode.Disposable {
	readonly analysis = new AnalysisProvider();
	readonly diagram: DiagramProvider;
	private readonly index = new ModelIndex();
	private readonly diagnostics: DiagnosticsProvider;
	private readonly registrations: vscode.Disposable[] = [];

	constructor(extensionUri: vscode.Uri) {
		this.diagram = new DiagramProvider(extensionUri);
		this.diagnostics = new DiagnosticsProvider(this.index);
		this.registrations.push(
			this.index,
			this.diagnostics,
			this.analysis,
			this.diagram,
			vscode.languages.registerHoverProvider(LANGUAGE_ID, new HoverProvider(this.index)),
			vscode.languages.registerDocumentFormattingEditProvider(
				LANGUAGE_ID,
				new FormattingProvider()
			),
			vscode.languages.registerDocumentSymbolProvider(LANGUAGE_ID, new SymbolProvider()),
			vscode.languages.registerCompletionItemProvider(
				LANGUAGE_ID,
				new CompletionProvider(this.index),
				"[",
				","
			),
			vscode.languages.registerSignatureHelpProvider(
				LANGUAGE_ID,
				new SignatureProvider(),
				"(",
				","
			),
			vscode.workspace.onDidSaveTextDocument((document) => {
				if (configGetAnalyzeOnSave() && isVerifpalDocument(document)) {
					void this.analysis.verify(document);
				}
			})
		);
	}

	/** Re-runs validation from scratch, e.g. after the binary changed. */
	refresh(): void {
		this.analysis.clear();
		this.diagnostics.refreshAll();
	}

	dispose(): void {
		for (const registration of this.registrations) {
			registration.dispose();
		}
	}
}

let session: Session | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const sync = (): void => {
		const enabled = configGetEnabled();
		if (enabled && !session) {
			session = new Session(context.extensionUri);
		} else if (!enabled && session) {
			session.dispose();
			session = undefined;
		}
	};
	sync();

	const requireSession = (): Session | undefined => {
		if (!session) {
			void vscode.window
				.showWarningMessage(
					"Verifpal: integration is disabled by the 'verifpal.enabled' setting.",
					"Open Settings"
				)
				.then((choice) => {
					if (choice === "Open Settings") {
						void vscode.commands.executeCommand(
							"workbench.action.openSettings",
							"verifpal.enabled"
						);
					}
				});
			return undefined;
		}
		return session;
	};

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("verifpal.verify", (editor) => {
			void requireSession()?.analysis.verify(editor.document);
		}),
		vscode.commands.registerTextEditorCommand("verifpal.showDiagram", (editor) => {
			void requireSession()?.diagram.show(editor.document);
		}),
		vscode.commands.registerCommand("verifpal.showOutput", () => {
			requireSession()?.analysis.showOutput();
		}),
		vscode.commands.registerCommand("verifpal.clearResults", () => {
			requireSession()?.analysis.clear();
		}),
		vscode.commands.registerCommand("verifpal.path", () => {
			vscode.window.showInformationMessage(
				`Verifpal: analyses run '${configDeterminePath()}'.`
			);
		}),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("verifpal.enabled")) {
				sync();
			}
			if (
				event.affectsConfiguration("verifpal.path") ||
				event.affectsConfiguration("verifpal.validateOnType")
			) {
				resetBinaryWarning();
				session?.refresh();
			}
		}),
		{ dispose: () => session?.dispose() }
	);
}

export function deactivate(): void {
	session?.dispose();
	session = undefined;
}

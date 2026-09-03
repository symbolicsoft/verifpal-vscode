/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions
} from "vscode-languageclient/node";
import AnalysisProvider from "./AnalysisProvider";
import DiagramProvider from "./DiagramProvider";
import { reportMissingBinary, resetBinaryWarning } from "./binary";
import {
	LANGUAGE_ID,
	configDeterminePath,
	configGetAnalyzeOnSave,
	configGetEnabled,
	configPathProblem,
	isVerifpalDocument
} from "./config";

/** The command the server puts on its code lens; it is routed through {@link AnalysisProvider}. */
const ANALYZE_COMMAND = "verifpal.analyze";

class Session implements vscode.Disposable {
	readonly client: LanguageClient;
	readonly analysis: AnalysisProvider;
	readonly diagram: DiagramProvider;
	private readonly registrations: vscode.Disposable[] = [];
	private starting: Promise<void> | undefined;

	constructor(extensionUri: vscode.Uri) {
		const problem = configPathProblem();
		if (problem) {
			void vscode.window.showWarningMessage(problem);
		}
		const command = configDeterminePath();
		const server: ServerOptions = {
			command,
			args: ["lsp", "--stdio"]
		};
		const options: LanguageClientOptions = {
			documentSelector: [{ scheme: "file", language: LANGUAGE_ID }, { scheme: "untitled", language: LANGUAGE_ID }],
			synchronize: {
				configurationSection: "verifpal"
			},
			outputChannelName: "Verifpal Language Server",
			middleware: {
				// The code lens above the queries block asks the server to
				// analyze directly. Going through the provider instead gives
				// it the spinner, the output and the configured session count.
				executeCommand: (command, args, next) => {
					const uri = (args[0] as { uri?: string } | undefined)?.uri;
					if (command === ANALYZE_COMMAND && typeof uri === "string") {
						return this.analysis.verifyUri(uri);
					}
					return next(command, args);
				}
			}
		};
		this.client = new LanguageClient("verifpal", "Verifpal", server, options);
		this.analysis = new AnalysisProvider(this.client);
		this.diagram = new DiagramProvider(extensionUri, this.client);
		this.registrations.push(
			this.analysis,
			this.diagram,
			vscode.workspace.onDidSaveTextDocument((document) => {
				if (configGetAnalyzeOnSave() && isVerifpalDocument(document)) {
					void this.analysis.verify(document);
				}
			})
		);
	}

	start(): Promise<void> {
		this.starting = this.client.start().catch((error: unknown) => {
			reportMissingBinary(String(error));
		});
		return this.starting;
	}

	/**
	 * Stops the server. A start still in progress is waited for first, or the
	 * process it spawns would outlive the session that owned it.
	 */
	async dispose(): Promise<void> {
		for (const registration of this.registrations) {
			registration.dispose();
		}
		await this.starting;
		if (this.client.isRunning()) {
			await this.client.stop();
		}
	}
}

let session: Session | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const sync = (): void => {
		const enabled = configGetEnabled();
		if (enabled && !session) {
			session = new Session(context.extensionUri);
			void session.start();
		} else if (!enabled && session) {
			void session.dispose();
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

	const restart = (): void => {
		if (session) {
			void session.dispose();
			session = undefined;
		}
		resetBinaryWarning();
		sync();
	};

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("verifpal.verify", (editor) => {
			void requireSession()?.analysis.verify(editor.document);
		}),
		vscode.commands.registerTextEditorCommand("verifpal.cancel", (editor) => {
			void requireSession()?.analysis.cancel(editor.document);
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
		vscode.commands.registerCommand("verifpal.restart", restart),
		vscode.commands.registerCommand("verifpal.path", () => {
			vscode.window.showInformationMessage(
				`Verifpal: the language server runs '${configDeterminePath()} lsp'.`
			);
		}),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("verifpal.enabled")) {
				sync();
			}
			if (event.affectsConfiguration("verifpal.path")) {
				restart();
			}
		}),
		{ dispose: () => void session?.dispose() }
	);
}

/** Returns the shutdown so the editor waits for the server to exit cleanly. */
export function deactivate(): Promise<void> | undefined {
	const closing = session?.dispose();
	session = undefined;
	return closing;
}

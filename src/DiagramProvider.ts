/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getPrettyDiagram } from "./VerifpalLib";
import { VerifpalRunError } from "./process";
import { reportRunError } from "./binary";
import { isVerifpalDocument } from "./config";

/**
 * The protocol diagram webview.
 *
 * One panel exists at a time and is bound to the document it was opened for.
 * The previous implementation created a fresh panel on every invocation while
 * tracking only the most recent one in a module variable, so a second panel
 * orphaned the first, and disposing *either* one left the survivor on screen
 * but permanently un-refreshable. Binding to a document also fixes the other
 * half of that: refreshes used to fire on any document's save, which piped
 * whatever file the user happened to be editing into Verifpal.
 *
 * Refreshes are sent as messages rather than by reassigning `webview.html`,
 * which would tear down and rebuild the page — losing scroll position and
 * flashing on every save.
 */
export default class DiagramProvider implements vscode.Disposable {
	private panel: vscode.WebviewPanel | undefined;
	private source: vscode.Uri | undefined;
	private ready = false;
	private pending: { title: string; body: string } | undefined;
	private readonly subscriptions: vscode.Disposable[] = [];

	constructor(private readonly extensionUri: vscode.Uri) {
		this.subscriptions.push(
			vscode.workspace.onDidSaveTextDocument((document) => {
				if (this.tracks(document)) {
					void this.refresh(document);
				}
			}),
			vscode.workspace.onDidCloseTextDocument((document) => {
				if (this.tracks(document)) {
					this.source = undefined;
				}
			})
		);
	}

	/** Whether an open diagram is showing `document`. */
	private tracks(document: vscode.TextDocument): boolean {
		return (
			this.panel !== undefined &&
			this.source !== undefined &&
			document.uri.toString() === this.source.toString()
		);
	}

	async show(document: vscode.TextDocument): Promise<void> {
		if (!isVerifpalDocument(document)) {
			vscode.window.showErrorMessage(
				"Verifpal: this command applies to Verifpal models (.vp) only."
			);
			return;
		}
		this.source = document.uri;
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.Beside, true);
		} else {
			this.panel = this.createPanel();
		}
		this.panel.title = `Diagram: ${path.basename(document.fileName)}`;
		await this.refresh(document);
	}

	private createPanel(): vscode.WebviewPanel {
		const panel = vscode.window.createWebviewPanel(
			"verifpal.diagram",
			"Verifpal Protocol Diagram",
			{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "res")]
			}
		);
		this.ready = false;
		panel.webview.html = this.html(panel.webview);
		panel.webview.onDidReceiveMessage((message: { type?: string }) => {
			if (message?.type === "ready") {
				this.ready = true;
				if (this.pending) {
					void panel.webview.postMessage({ type: "diagram", ...this.pending });
				}
			}
		});
		panel.onDidDispose(() => {
			this.panel = undefined;
			this.source = undefined;
			this.pending = undefined;
			this.ready = false;
		});
		return panel;
	}

	private async refresh(document: vscode.TextDocument): Promise<void> {
		const panel = this.panel;
		if (!panel) {
			return;
		}
		const title = path.basename(document.fileName);
		let body: string;
		try {
			body = await getPrettyDiagram(document.getText());
		} catch (error) {
			// The panel is still current only if nothing disposed it meanwhile.
			if (this.panel === panel) {
				const message =
					error instanceof VerifpalRunError && error.isModelError
						? error.message
						: "Verifpal could not read this model.";
				void panel.webview.postMessage({ type: "error", message });
			}
			if (!(error instanceof VerifpalRunError) || !error.isModelError) {
				reportRunError(error, "diagram generation");
			}
			return;
		}
		if (this.panel !== panel) {
			return;
		}
		this.pending = { title, body };
		if (this.ready) {
			void panel.webview.postMessage({ type: "diagram", title, body });
		}
	}

	private html(webview: vscode.Webview): string {
		const template = fs
			.readFileSync(path.join(this.extensionUri.fsPath, "res", "diagram.html"))
			.toString();
		const nonce = crypto.randomBytes(16).toString("base64");
		const asset = (name: string): string =>
			webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "res", name)).toString();
		const csp =
			`default-src 'none'; script-src 'nonce-${nonce}'; ` +
			`style-src 'unsafe-inline'; font-src ${webview.cspSource};`;
		return template
			.replace(/\$\$CSP\$\$/g, csp)
			.replace(/\$\$NONCE\$\$/g, nonce)
			.replace("$$EXTPATH1$$", asset("webfont.js"))
			.replace("$$EXTPATH2$$", asset("snap.svg-min.js"))
			.replace("$$EXTPATH3$$", asset("underscore-min.js"))
			.replace("$$EXTPATH4$$", asset("sequence-diagram-min.js"));
	}

	dispose(): void {
		for (const subscription of this.subscriptions) {
			subscription.dispose();
		}
		this.panel?.dispose();
	}
}

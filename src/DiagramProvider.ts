/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import VerifpalLib from "./VerifpalLib";

let diagramActive = false;
let webviewPanel: vscode.WebviewPanel | undefined;

export function isDiagramActive(): boolean {
	return diagramActive;
}

export function createDiagramPanel(
	editor: vscode.TextEditor,
	extensionUri: vscode.Uri,
): void {
	const fileName = editor.document.fileName;
	const fileContents = editor.document.getText();
	webviewPanel = vscode.window.createWebviewPanel(
		"verifpal",
		"Verifpal Protocol Diagram",
		vscode.ViewColumn.Beside,
		{
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(extensionUri, "res")],
		}
	);
	webviewPanel.onDidDispose(() => {
		diagramActive = false;
		webviewPanel = undefined;
	});
	renderDiagram(fileName, fileContents, extensionUri);
}

export function renderDiagram(
	fileName: string,
	fileContents: string,
	extensionUri: vscode.Uri,
): void {
	if (!webviewPanel) {
		return;
	}
	diagramActive = true;
	const modelName = path.basename(fileName);
	const extensionPath = extensionUri.fsPath;
	let diagramHtml = fs.readFileSync(
		path.join(extensionPath, "res", "diagram.html")
	).toString();
	VerifpalLib.getPrettyDiagram(fileContents).then((result: string) => {
		if (!webviewPanel) {
			return;
		}
		const webview = webviewPanel.webview;
		const nonce = crypto.randomBytes(16).toString("base64");
		const ep1 = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "res", "webfont.js"));
		const ep2 = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "res", "snap.svg-min.js"));
		const ep3 = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "res", "underscore-min.js"));
		const ep4 = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "res", "sequence-diagram-min.js"));
		const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; font-src ${webview.cspSource};`;
		diagramHtml = diagramHtml.replace(/\$\$CSP\$\$/g, csp);
		diagramHtml = diagramHtml.replace(/\$\$NONCE\$\$/g, nonce);
		diagramHtml = diagramHtml.replace("$$EXTPATH1$$", ep1.toString());
		diagramHtml = diagramHtml.replace("$$EXTPATH2$$", ep2.toString());
		diagramHtml = diagramHtml.replace("$$EXTPATH3$$", ep3.toString());
		diagramHtml = diagramHtml.replace("$$EXTPATH4$$", ep4.toString());
		diagramHtml = diagramHtml.replace("$$MODELNAME$$", modelName);
		diagramHtml = diagramHtml.replace("$$DIAGRAM$$", result);
		webviewPanel.webview.html = diagramHtml;
	}).catch(() => {
		vscode.window.showErrorMessage(
			"Verifpal: Your model is invalid and cannot be analyzed or visualized. Check for syntax errors."
		);
	});
}

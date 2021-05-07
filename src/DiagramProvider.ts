/* SPDX-FileCopyrightText: © 2019-2021 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import VerifpalLib from "./VerifpalLib";

const fs = require("fs");
const path = require("path");

export default class DiagramProvider {

	static diagramActive = false;

	static webviewPanel: vscode.WebviewPanel;

	static renderDiagram(fileName: string, fileContents: string, extensionPath: string) {
		this.diagramActive = true;
		const modelName = path.basename(fileName);
		let diagramHtml = fs.readFileSync(
			path.join(extensionPath, "res", "diagram.html")
		).toString();
		VerifpalLib.getPrettyDiagram(fileContents).then((result: string) => {
			const ep1 = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "webfont.js")
			));
			const ep2 = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "snap.svg-min.js")
			));
			const ep3 = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "underscore-min.js")
			));
			const ep4 = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "sequence-diagram-min.js")
			));
			diagramHtml = diagramHtml.replace("$$EXTPATH1$$", ep1);
			diagramHtml = diagramHtml.replace("$$EXTPATH2$$", ep2);
			diagramHtml = diagramHtml.replace("$$EXTPATH3$$", ep3);
			diagramHtml = diagramHtml.replace("$$EXTPATH4$$", ep4);
			diagramHtml = diagramHtml.replace("$$MODELNAME$$", modelName);
			diagramHtml = diagramHtml.replace("$$DIAGRAM$$", result);
			this.webviewPanel.webview.html = diagramHtml;
		}).catch(() => {
			vscode.window.showErrorMessage("Verifpal: Your model is invalid and cannot be analyzed or visualized. Check for syntax errors.");
		});
	}
}
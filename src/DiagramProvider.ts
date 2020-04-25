/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
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
		let modelName = path.basename(fileName);
		let diagramHtml = fs.readFileSync(vscode.Uri.file(
			path.join(extensionPath, "res", "diagram.html")
		).path).toString();
		VerifpalLib.getPrettyDiagram(fileContents).then((result: string) => {
			let ep1 = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "webfont.js")
			));
			let ep2 = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "snap.svg-min.js")
			));
			let ep3 = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "underscore-min.js")
			));
			let ep4 = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "sequence-diagram-min.js")
			));
			let icon = this.webviewPanel.webview.asWebviewUri(vscode.Uri.file(
				path.join(extensionPath, "res", "icon.png")
			));
			diagramHtml = diagramHtml.replace("$$EXTPATH1$$", ep1);
			diagramHtml = diagramHtml.replace("$$EXTPATH2$$", ep2);
			diagramHtml = diagramHtml.replace("$$EXTPATH3$$", ep3);
			diagramHtml = diagramHtml.replace("$$EXTPATH4$$", ep4);
			diagramHtml = diagramHtml.replace("$$ICON$$", icon);
			diagramHtml = diagramHtml.replace("$$MODELNAME$$", modelName);
			diagramHtml = diagramHtml.replace("$$DIAGRAM$$", result);
			this.webviewPanel.webview.html = diagramHtml;
		});
	}
}
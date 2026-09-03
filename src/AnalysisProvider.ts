/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { ExecuteCommandRequest } from "vscode-languageclient";
import {
	ANALYSIS_REPORT,
	describeAssumption,
	indexOfByteOffset,
	type Accepted,
	type AnalysisReport,
	type QueryReport
} from "./protocol";
import { configGetSessions, isVerifpalDocument } from "./config";

export default class AnalysisProvider implements vscode.Disposable {
	private readonly passedDecoration: vscode.TextEditorDecorationType;
	private readonly failedDecoration: vscode.TextEditorDecorationType;
	private readonly output: vscode.OutputChannel;
	private readonly status: vscode.StatusBarItem;
	private readonly reports = new Map<string, AnalysisReport>();
	private readonly subscriptions: vscode.Disposable[] = [];
	/** The token of the run in flight for each document, so a superseded run's report is told apart. */
	private readonly running = new Map<string, string>();

	constructor(private readonly client: LanguageClient) {
		this.passedDecoration = vscode.window.createTextEditorDecorationType({
			border: "1px solid",
			borderColor: new vscode.ThemeColor("charts.green"),
			borderRadius: "3px",
			fontWeight: "bold"
		});
		this.failedDecoration = vscode.window.createTextEditorDecorationType({
			border: "1px solid",
			borderColor: new vscode.ThemeColor("charts.red"),
			borderRadius: "3px",
			fontWeight: "bold"
		});
		this.output = vscode.window.createOutputChannel("Verifpal Analysis");
		this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.status.command = "verifpal.showOutput";

		this.subscriptions.push(
			this.output,
			this.status,
			this.passedDecoration,
			this.failedDecoration,
			client.onNotification(ANALYSIS_REPORT, (report: AnalysisReport) =>
				this.onReport(report)
			),
			vscode.workspace.onDidChangeTextDocument((event) => {
				// The event also fires when only the dirty flag changes, as it
				// does on save; a result is stale only when the text is.
				if (event.contentChanges.length > 0 && isVerifpalDocument(event.document)) {
					this.forget(event.document.uri.toString());
				}
			}),
			vscode.workspace.onDidCloseTextDocument((document) =>
				this.forget(document.uri.toString())
			),
			vscode.window.onDidChangeActiveTextEditor(() => this.render())
		);
	}

	async verify(document: vscode.TextDocument): Promise<void> {
		if (!isVerifpalDocument(document)) {
			vscode.window.showErrorMessage(
				"Verifpal: this command applies to Verifpal models (.vp) only."
			);
			return;
		}
		const uri = document.uri.toString();
		this.status.text = "$(sync~spin) Verifpal";
		this.status.tooltip = "Verifpal analysis running";
		this.status.show();
		this.output.appendLine(`Analyzing ${document.fileName}…`);

		const sessions = configGetSessions();
		let accepted: Accepted | null;
		try {
			accepted = (await this.client.sendRequest(ExecuteCommandRequest.type, {
				command: "verifpal.analyze",
				arguments: [{ uri, sessions }]
			})) as Accepted | null;
		} catch (error) {
			this.settle(uri);
			this.output.appendLine(`The language server did not take the request: ${String(error)}`);
			vscode.window.showErrorMessage(
				"Verifpal: the language server is not running. See the Verifpal Language Server output for why."
			);
			return;
		}
		if (!accepted?.accepted) {
			this.settle(uri);
			const reason = accepted?.reason ? `: ${accepted.reason}` : ".";
			this.output.appendLine(`The server declined to analyze this document${reason}`);
			return;
		}
		this.running.set(uri, accepted.token);
	}

	/** Verifies the open document with this URI, as the code lens above the queries asks to. */
	async verifyUri(uri: string): Promise<void> {
		const document = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri);
		if (document) {
			await this.verify(document);
		}
	}

	async cancel(document: vscode.TextDocument): Promise<void> {
		const uri = document.uri.toString();
		try {
			await this.client.sendRequest(ExecuteCommandRequest.type, {
				command: "verifpal.cancelAnalysis",
				arguments: [{ uri }]
			});
		} catch (error) {
			this.output.appendLine(`The language server did not take the request: ${String(error)}`);
		}
		this.settle(uri);
	}

	showOutput(): void {
		this.output.show(true);
	}

	clear(): void {
		this.reports.clear();
		this.running.clear();
		this.status.hide();
		this.render();
	}

	/** No run is in flight for `uri` any more; the status bar follows. */
	private settle(uri: string): void {
		this.running.delete(uri);
		this.render();
		if (!this.reports.has(uri)) {
			this.status.hide();
		}
	}

	private forget(uri: string): void {
		if (this.reports.delete(uri)) {
			this.render();
		}
	}

	private onReport(report: AnalysisReport): void {
		const current = this.running.get(report.uri);
		if (report.token !== undefined && current !== undefined && current !== report.token) {
			// A run this one replaced is reporting, usually that it was
			// cancelled. The replacement is still going.
			return;
		}
		this.running.delete(report.uri);
		if (!report.ok) {
			this.status.hide();
			if (report.cancelled) {
				this.output.appendLine("Analysis cancelled.");
			} else if (report.error) {
				this.output.appendLine(report.error);
			}
			return;
		}
		const document = vscode.workspace.textDocuments.find(
			(d) => d.uri.toString() === report.uri
		);
		if (document && document.version !== report.version) {
			this.output.appendLine("Discarded a result for text that has since changed.");
			this.status.hide();
			return;
		}
		this.reports.set(report.uri, report);
		this.write(report);
		this.render();
	}

	private write(report: AnalysisReport): void {
		const queries = report.queries ?? [];
		const attacks = report.attacks ?? 0;
		this.output.appendLine("");
		this.output.appendLine(
			`${report.model ?? ""}  ${report.code ?? ""}  ·  ${report.sessions ?? 0} sessions  ` +
				`·  ${report.elapsedMs ?? 0} ms  ·  ${attacks} of ${queries.length} contradicted`
		);
		for (const assumption of report.assumptions ?? []) {
			this.output.appendLine(`  assumption: ${describeAssumption(assumption)}`);
		}
		for (const q of queries) {
			this.output.appendLine("");
			this.output.appendLine(`${q.resolved ? "FAIL" : "PASS"}  ${q.query}`);
			if (q.conclusion) {
				this.output.appendLine(`      ${q.conclusion}`);
			}
			q.steps.forEach((step, i) => {
				this.output.appendLine(`      ${i + 1}. ${step.text}`);
			});
			for (const precondition of q.preconditions) {
				this.output.appendLine(`      precondition: ${precondition}`);
			}
		}
	}

	private render(): void {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !isVerifpalDocument(editor.document)) {
			this.status.hide();
			return;
		}
		const uri = editor.document.uri.toString();
		const report = this.reports.get(uri);
		if (!report) {
			editor.setDecorations(this.passedDecoration, []);
			editor.setDecorations(this.failedDecoration, []);
			if (this.running.has(uri)) {
				this.status.text = "$(sync~spin) Verifpal";
				this.status.tooltip = "Verifpal analysis running";
				this.status.show();
			} else {
				this.status.hide();
			}
			return;
		}
		const queries = report.queries ?? [];
		editor.setDecorations(this.passedDecoration, ranges(editor.document, queries, false));
		editor.setDecorations(this.failedDecoration, ranges(editor.document, queries, true));

		const attacks = report.attacks ?? 0;
		this.status.text = attacks > 0 ? `$(shield) ${report.code}` : `$(check) ${report.code}`;
		this.status.tooltip =
			attacks > 0
				? `Verifpal: ${attacks} of ${queries.length} queries contradicted`
				: `Verifpal: all ${queries.length} queries hold`;
		this.status.show();
	}

	dispose(): void {
		for (const subscription of this.subscriptions) {
			subscription.dispose();
		}
	}
}

function ranges(
	document: vscode.TextDocument,
	queries: QueryReport[],
	resolved: boolean
): vscode.Range[] {
	const text = document.getText();
	return queries
		.filter((q) => q.resolved === resolved)
		.map(
			(q) =>
				new vscode.Range(
					document.positionAt(indexOfByteOffset(text, q.range.start)),
					document.positionAt(indexOfByteOffset(text, q.range.end))
				)
		)
		.map((range) => document.validateRange(range));
}

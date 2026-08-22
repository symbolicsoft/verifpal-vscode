/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { ExecuteCommandRequest } from "vscode-languageclient";
import {
	ANALYSIS_REPORT,
	describeAssumption,
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
	private running = new Set<string>();

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
				if (isVerifpalDocument(event.document)) {
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
		this.running.add(uri);
		this.status.text = "$(sync~spin) Verifpal";
		this.status.tooltip = "Verifpal analysis running";
		this.status.show();
		this.output.appendLine(`Analyzing ${document.fileName}…`);

		const sessions = configGetSessions();
		const accepted = (await this.client.sendRequest(ExecuteCommandRequest.type, {
			command: "verifpal.analyze",
			arguments: [{ uri, sessions }]
		})) as Accepted | null;
		if (!accepted?.accepted) {
			this.running.delete(uri);
			this.status.hide();
			this.output.appendLine("The server declined to analyze this document.");
		}
	}

	async cancel(document: vscode.TextDocument): Promise<void> {
		const uri = document.uri.toString();
		await this.client.sendRequest(ExecuteCommandRequest.type, {
			command: "verifpal.cancelAnalysis",
			arguments: [{ uri }]
		});
		this.running.delete(uri);
		this.status.hide();
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

	private forget(uri: string): void {
		if (this.reports.delete(uri)) {
			this.render();
		}
	}

	private onReport(report: AnalysisReport): void {
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
		const report = this.reports.get(editor.document.uri.toString());
		if (!report) {
			editor.setDecorations(this.passedDecoration, []);
			editor.setDecorations(this.failedDecoration, []);
			if (!this.running.has(editor.document.uri.toString())) {
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
	return queries
		.filter((q) => q.resolved === resolved)
		.map((q) => new vscode.Range(document.positionAt(q.range.start), document.positionAt(q.range.end)))
		.map((range) => document.validateRange(range));
}

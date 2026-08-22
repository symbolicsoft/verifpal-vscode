/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import * as path from "path";
import {
	DEFAULT_SESSIONS,
	describeAssumption,
	getVerify,
	type Assumption,
	type VerifyResult
} from "./VerifpalLib";
import { findConstantOccurrences, findQueryOccurrences, stripAnsi, type TextRange } from "./parse";
import { VerifpalRunError } from "./process";
import { reportRunError } from "./binary";
import { isVerifpalDocument } from "./config";

interface AnalysisRecord {
	results: VerifyResult[];
	assumptions: Assumption[];
	passed: TextRange[];
	failed: TextRange[];
}

/**
 * Attacker analysis: running it, and everything that shows its outcome.
 *
 * Results reach the user three ways, because they answer different questions.
 * The decorations say *which line*; the Problems panel says *what went wrong*
 * and carries the attack trace; the output channel is the full record. The
 * status bar is the fourth, and only says whether the model currently holds.
 *
 * All of it is discarded the moment the document changes. Results describe the
 * text they were computed from, and a green box floating over edited text is
 * worse than no box at all.
 */
export default class AnalysisProvider implements vscode.Disposable {
	private readonly passedDecoration: vscode.TextEditorDecorationType;
	private readonly failedDecoration: vscode.TextEditorDecorationType;
	private readonly output: vscode.OutputChannel;
	private readonly collection: vscode.DiagnosticCollection;
	private readonly status: vscode.StatusBarItem;
	private readonly records = new Map<string, AnalysisRecord>();
	private readonly subscriptions: vscode.Disposable[] = [];
	private running: { uri: string; abort: AbortController } | undefined;

	constructor() {
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
		this.collection = vscode.languages.createDiagnosticCollection("verifpal-analysis");
		this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.status.command = "verifpal.showOutput";

		this.subscriptions.push(
			this.passedDecoration,
			this.failedDecoration,
			this.output,
			this.collection,
			this.status,
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (event.contentChanges.length === 0) {
					return;
				}
				if (this.records.has(event.document.uri.toString())) {
					this.clear(event.document.uri);
				}
			}),
			vscode.workspace.onDidCloseTextDocument((document) => this.clear(document.uri)),
			vscode.window.onDidChangeVisibleTextEditors(() => this.applyDecorations()),
			vscode.window.onDidChangeActiveTextEditor(() => this.updateStatus())
		);
		this.updateStatus();
	}

	showOutput(): void {
		this.output.show(true);
	}

	/** Drops the results for one document, or for all of them. */
	clear(uri?: vscode.Uri): void {
		if (uri) {
			this.records.delete(uri.toString());
			this.collection.delete(uri);
		} else {
			this.records.clear();
			this.collection.clear();
		}
		this.applyDecorations();
		this.updateStatus();
	}

	async verify(document: vscode.TextDocument): Promise<void> {
		if (!isVerifpalDocument(document)) {
			vscode.window.showErrorMessage("Verifpal: this command applies to Verifpal models (.vp) only.");
			return;
		}
		if (this.running) {
			const choice = await vscode.window.showWarningMessage(
				"Verifpal: an analysis is already running.",
				"Cancel It"
			);
			if (choice === "Cancel It") {
				this.running.abort.abort();
			}
			return;
		}

		const uri = document.uri.toString();
		const abort = new AbortController();
		this.running = { uri, abort };
		this.clear(document.uri);
		this.setStatusAnalyzing();

		const text = document.getText();
		const version = document.version;
		const name = path.basename(document.fileName);

		let results: VerifyResult[];
		try {
			results = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Verifpal: analyzing ${name}…`,
					cancellable: true
				},
				(_progress, token) => {
					token.onCancellationRequested(() => abort.abort());
					return getVerify(text, abort.signal);
				}
			);
		} catch (error) {
			this.running = undefined;
			this.updateStatus();
			if (error instanceof VerifpalRunError && error.isModelError) {
				vscode.window.showErrorMessage(
					`Verifpal: ${name} cannot be analyzed. See the Problems panel for the offending line.`
				);
				return;
			}
			reportRunError(error, "analysis");
			return;
		}

		this.running = undefined;
		// The model was edited while the analysis ran, so the results no longer
		// describe it. They are still worth writing down, but not worth marking
		// text with.
		const stale = document.isClosed || document.version !== version;
		this.record(document, text, results, stale);
	}

	private record(
		document: vscode.TextDocument,
		text: string,
		raw: VerifyResult[],
		stale: boolean
	): void {
		const results: VerifyResult[] = raw.map((r) => ({
			Query: r.Query,
			Resolved: r.Resolved,
			Summary: stripAnsi(r.Summary ?? ""),
			Constants: r.Constants ?? [],
			Assumptions: r.Assumptions ?? []
		}));
		const assumptions = collectAssumptions(results);
		const attacks = results.filter((r) => r.Resolved).length;
		this.report(path.basename(document.fileName), results, assumptions);

		if (stale) {
			this.output.show(true);
			vscode.window.showWarningMessage(
				"Verifpal: the model changed while it was being analyzed. " +
				"The results are in the Verifpal Analysis output, but they describe the earlier text."
			);
			return;
		}

		const { passed, failed, diagnostics } = locate(text, results);
		this.records.set(document.uri.toString(), { results, assumptions, passed, failed });
		this.collection.set(document.uri, diagnostics);
		this.applyDecorations();
		this.updateStatus();

		if (attacks > 0) {
			this.output.show(true);
			vscode.window.showWarningMessage(
				`Verifpal: ${attacks} of ${results.length} ${plural(results.length, "query", "queries")} ` +
				`${attacks === 1 ? "was" : "were"} resolved by an attack. See the Problems panel for the traces.`
			);
		} else if (assumptions.length > 0) {
			this.output.show(true);
			vscode.window.showWarningMessage(
				`Verifpal: no attack found, but the result holds only under ${assumptions.length} declared ` +
				`weakening ${plural(assumptions.length, "assumption", "assumptions")}. See the Verifpal Analysis output.`
			);
		} else {
			vscode.window.showInformationMessage(
				`Verifpal: no attack found for ${results.length} ${plural(results.length, "query", "queries")} ` +
				`within ${DEFAULT_SESSIONS} sessions per principal.`
			);
		}
	}

	/**
	 * The written record of one analysis.
	 *
	 * It closes on what the run does *not* establish. Verifpal analyses a
	 * bounded number of concurrent sessions, so "no attack found" is a
	 * statement about that bound; and a model that declares a weakening
	 * assumption is not being analyzed on its own terms, so neither an attack
	 * nor a clean result under one is unconditional. Both belong next to the
	 * verdict rather than in a manual.
	 */
	private report(name: string, results: VerifyResult[], assumptions: Assumption[]): void {
		const attacks = results.filter((r) => r.Resolved).length;
		this.output.appendLine("─".repeat(72));
		this.output.appendLine(`Verifpal · ${name} · ${new Date().toLocaleTimeString()}`);
		this.output.appendLine("");
		for (const result of results) {
			this.output.appendLine(`${result.Resolved ? "✗" : "✓"} ${result.Query}`);
			const summary = result.Summary.trim();
			if (summary.length > 0) {
				for (const line of summary.split("\n")) {
					this.output.appendLine(`    ${line.trim()}`);
				}
			}
		}
		this.output.appendLine("");
		this.output.appendLine(
			`${results.length} ${plural(results.length, "query", "queries")}, ` +
			`${attacks} ${plural(attacks, "attack", "attacks")} found.`
		);
		this.output.appendLine(
			`Analyzed at Verifpal's default of ${DEFAULT_SESSIONS} concurrent sessions per principal. ` +
			"A query that holds here holds within that bound, not in general."
		);
		if (assumptions.length > 0) {
			this.output.appendLine("");
			this.output.appendLine(
				`Results hold only under ${assumptions.length} declared weakening ` +
				`${plural(assumptions.length, "assumption", "assumptions")}:`
			);
			for (const assumption of assumptions) {
				this.output.appendLine(`  ${describeAssumption(assumption)}`);
			}
		}
		this.output.appendLine("");
	}

	private applyDecorations(): void {
		for (const editor of vscode.window.visibleTextEditors) {
			const record = this.records.get(editor.document.uri.toString());
			editor.setDecorations(this.passedDecoration, (record?.passed ?? []).map(toRange));
			editor.setDecorations(this.failedDecoration, (record?.failed ?? []).map(toRange));
		}
	}

	private setStatusAnalyzing(): void {
		this.status.text = "$(sync~spin) Verifpal: analyzing…";
		this.status.tooltip = "Verifpal is analyzing this model. Click to open the analysis output.";
		this.status.backgroundColor = undefined;
		this.status.show();
	}

	private updateStatus(): void {
		const editor = vscode.window.activeTextEditor;
		if (!isVerifpalDocument(editor?.document)) {
			this.status.hide();
			return;
		}
		if (this.running && editor && this.running.uri === editor.document.uri.toString()) {
			this.setStatusAnalyzing();
			return;
		}
		const record = editor && this.records.get(editor.document.uri.toString());
		if (!record) {
			this.status.text = "$(shield) Verifpal";
			this.status.tooltip = "No analysis has been run for this model yet.";
			this.status.backgroundColor = undefined;
			this.status.show();
			return;
		}
		const attacks = record.results.filter((r) => r.Resolved).length;
		const conditional = record.assumptions.length > 0 ? ", conditional" : "";
		if (attacks > 0) {
			this.status.text = `$(shield) Verifpal: ${attacks} ${plural(attacks, "attack", "attacks")}`;
			this.status.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
		} else {
			this.status.text = `$(shield) Verifpal: ${record.results.length} held${conditional}`;
			this.status.backgroundColor = record.assumptions.length > 0
				? new vscode.ThemeColor("statusBarItem.warningBackground")
				: undefined;
		}
		this.status.tooltip = new vscode.MarkdownString(
			`Analyzed at ${DEFAULT_SESSIONS} concurrent sessions per principal.` +
			(record.assumptions.length > 0
				? `\n\nHolds only under ${record.assumptions.length} declared weakening assumption(s).`
				: "") +
			"\n\nClick to open the analysis output."
		);
		this.status.show();
	}

	dispose(): void {
		this.running?.abort.abort();
		for (const subscription of this.subscriptions) {
			subscription.dispose();
		}
	}
}

function toRange(r: TextRange): vscode.Range {
	return new vscode.Range(new vscode.Position(r.line, r.start), new vscode.Position(r.line, r.end));
}

function plural(n: number, one: string, many: string): string {
	return n === 1 ? one : many;
}

/**
 * Every assumption declared in the model. Verifpal repeats the same list on
 * each result, so any one of them will do; take the first non-empty one.
 */
function collectAssumptions(results: VerifyResult[]): Assumption[] {
	for (const result of results) {
		if (result.Assumptions && result.Assumptions.length > 0) {
			return result.Assumptions;
		}
	}
	return [];
}

/**
 * Turns results into positions in the model text.
 *
 * Only resolved queries become diagnostics. The Problems panel is a list of
 * things to act on, and twenty "this query held" rows would bury the one that
 * did not; a query that held is reported by its green decoration and in the
 * output channel instead.
 */
function locate(
	text: string,
	results: VerifyResult[]
): { passed: TextRange[]; failed: TextRange[]; diagnostics: vscode.Diagnostic[] } {
	const passed: TextRange[] = [];
	const failed: TextRange[] = [];
	const diagnostics: vscode.Diagnostic[] = [];

	for (const result of results) {
		const occurrences = findQueryOccurrences(text, result.Query);
		if (result.Resolved) {
			failed.push(...occurrences);
			for (const constant of result.Constants) {
				failed.push(...findConstantOccurrences(text, constant));
			}
			const anchor = occurrences[0];
			const range = anchor
				? new vscode.Range(
					new vscode.Position(anchor.line, anchor.start),
					new vscode.Position(anchor.line, anchor.end)
				)
				: new vscode.Range(0, 0, 0, 0);
			const summary = result.Summary.trim();
			const diagnostic = new vscode.Diagnostic(
				range,
				summary.length > 0
					? `${result.Query} — resolved by an attack.\n${summary}`
					: `${result.Query} — resolved by an attack.`,
				vscode.DiagnosticSeverity.Error
			);
			diagnostic.source = "verifpal";
			diagnostic.code = "attack";
			diagnostics.push(diagnostic);
		} else {
			passed.push(...occurrences);
		}
	}
	return { passed, failed, diagnostics };
}

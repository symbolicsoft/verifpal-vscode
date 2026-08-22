/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import ModelIndex from "./ModelIndex";
import { configGetValidateOnType, isVerifpalDocument } from "./config";
import { reportRunError } from "./binary";
import type { ModelError } from "./parse";

const DEBOUNCE_MS = 400;

/**
 * Live model validation in the Problems panel.
 *
 * Verifpal reports every parse and sanity failure as `file:line:col` with a
 * caret run under the offending span, which is precise enough to place a
 * squiggle exactly where the engine objected. The extension used to discard
 * all of it and show one generic "your model is invalid" notification, which
 * told the user that something was wrong but not what or where.
 *
 * Validation is a `knowledgeMap` invocation because that is the cheapest
 * subcommand that still runs the full parse-and-sanity pipeline — the same one
 * a real analysis would fail in.
 */
export default class DiagnosticsProvider implements vscode.Disposable {
	private readonly collection: vscode.DiagnosticCollection;
	private readonly timers = new Map<string, NodeJS.Timeout>();
	private readonly subscriptions: vscode.Disposable[] = [];

	constructor(private readonly index: ModelIndex) {
		this.collection = vscode.languages.createDiagnosticCollection("verifpal");
		this.subscriptions.push(
			this.collection,
			vscode.workspace.onDidOpenTextDocument((document) => this.validateNow(document)),
			vscode.workspace.onDidSaveTextDocument((document) => this.validateNow(document)),
			vscode.workspace.onDidChangeTextDocument((event) => this.schedule(event.document)),
			vscode.workspace.onDidCloseTextDocument((document) => this.forget(document))
		);
		for (const document of vscode.workspace.textDocuments) {
			this.validateNow(document);
		}
	}

	/** Re-validates every open model, e.g. after the binary path changed. */
	refreshAll(): void {
		this.index.clear();
		this.collection.clear();
		for (const document of vscode.workspace.textDocuments) {
			this.validateNow(document);
		}
	}

	private schedule(document: vscode.TextDocument): void {
		if (!isVerifpalDocument(document) || !configGetValidateOnType()) {
			return;
		}
		const key = document.uri.toString();
		const existing = this.timers.get(key);
		if (existing) {
			clearTimeout(existing);
		}
		const timer = setTimeout(() => {
			this.timers.delete(key);
			void this.validate(document);
		}, DEBOUNCE_MS);
		timer.unref?.();
		this.timers.set(key, timer);
	}

	private validateNow(document: vscode.TextDocument): void {
		if (!isVerifpalDocument(document)) {
			return;
		}
		const key = document.uri.toString();
		const existing = this.timers.get(key);
		if (existing) {
			clearTimeout(existing);
			this.timers.delete(key);
		}
		void this.validate(document);
	}

	private async validate(document: vscode.TextDocument): Promise<void> {
		if (document.isClosed) {
			return;
		}
		const version = document.version;
		const state = await this.index.load(document);
		// A newer revision is already on its way; publishing this one would
		// leave squiggles pointing at text the user has since replaced.
		if (document.isClosed || document.version !== version) {
			return;
		}
		if (state.kind === "invalid") {
			this.collection.set(
				document.uri,
				state.errors.length > 0
					? state.errors.map((error) => toDiagnostic(document, error))
					: [wholeDocumentDiagnostic(document, state.message)]
			);
			return;
		}
		// A model that parses, and one the extension could not check at all,
		// both leave nothing to report against a line. The second case is not
		// silent though: if Verifpal cannot be run, that is the whole reason
		// the Problems panel is empty, and the user should hear it once.
		this.collection.delete(document.uri);
		if (state.kind === "unavailable") {
			reportRunError(state.error, "model checking");
		}
	}

	private forget(document: vscode.TextDocument): void {
		const key = document.uri.toString();
		const timer = this.timers.get(key);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(key);
		}
		this.collection.delete(document.uri);
		this.index.forget(document.uri);
	}

	dispose(): void {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.timers.clear();
		for (const subscription of this.subscriptions) {
			subscription.dispose();
		}
	}
}

function toDiagnostic(document: vscode.TextDocument, error: ModelError): vscode.Diagnostic {
	const range = document.validateRange(
		new vscode.Range(
			new vscode.Position(error.line, error.column),
			new vscode.Position(error.line, error.column + error.length)
		)
	);
	const diagnostic = new vscode.Diagnostic(
		range.isEmpty ? document.lineAt(range.start.line).range : range,
		error.message,
		vscode.DiagnosticSeverity.Error
	);
	diagnostic.source = "verifpal";
	diagnostic.code = `${error.kind} error`;
	return diagnostic;
}

function wholeDocumentDiagnostic(document: vscode.TextDocument, message: string): vscode.Diagnostic {
	const diagnostic = new vscode.Diagnostic(
		document.lineAt(0).range,
		message,
		vscode.DiagnosticSeverity.Error
	);
	diagnostic.source = "verifpal";
	return diagnostic;
}

/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import { scanModelSymbols, type ModelSymbol, type ModelSymbolKind } from "./parse";

const KINDS: Record<ModelSymbolKind, vscode.SymbolKind> = {
	principal: vscode.SymbolKind.Class,
	message: vscode.SymbolKind.Event,
	phase: vscode.SymbolKind.Module,
	queries: vscode.SymbolKind.Namespace,
	query: vscode.SymbolKind.Property,
	value: vscode.SymbolKind.Variable
};

/**
 * Outline, breadcrumbs, and `Go to Symbol` over a model.
 *
 * The scan is lexical rather than a call into Verifpal, which is deliberate:
 * an outline is most useful while a model is mid-edit and does not yet parse,
 * and it should not cost a subprocess on every keystroke. Listing each
 * principal's bound values as children turns `Ctrl+Shift+O` into a jump to
 * wherever a constant was declared.
 */
export default class SymbolProvider implements vscode.DocumentSymbolProvider {
	provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
		return scanModelSymbols(document.getText()).map((symbol) => convert(document, symbol));
	}
}

function convert(document: vscode.TextDocument, symbol: ModelSymbol): vscode.DocumentSymbol {
	const full = document.validateRange(
		new vscode.Range(
			new vscode.Position(symbol.startLine, 0),
			new vscode.Position(symbol.endLine, Number.MAX_SAFE_INTEGER)
		)
	);
	const selection = document.validateRange(
		new vscode.Range(
			new vscode.Position(symbol.startLine, symbol.nameStart),
			new vscode.Position(symbol.startLine, symbol.nameEnd)
		)
	);
	const node = new vscode.DocumentSymbol(
		symbol.name,
		symbol.detail,
		KINDS[symbol.kind],
		full,
		selection.isEmpty ? full : selection
	);
	node.children = symbol.children.map((child) => convert(document, child));
	return node;
}

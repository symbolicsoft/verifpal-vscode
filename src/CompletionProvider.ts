/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import ModelIndex from "./ModelIndex";
import { contextAt } from "./parse";
import {
	CAPABILITIES,
	PRIMITIVES,
	QUERIES,
	lookupPrimitive,
	primitiveNotes,
	type Primitive
} from "./spec";

/**
 * Completions scoped to where the cursor is.
 *
 * Offering all 25 primitives inside a `queries[…]` block, or the query
 * keywords inside a principal, is noise; the position tells you which
 * vocabulary is admissible. The capability list is further narrowed to what
 * the primitive at the cursor actually declares, since Verifpal rejects a
 * capability the primitive does not support rather than ignoring it — so
 * suggesting `HASH[forgeable]` would be suggesting a hard error.
 */
export default class CompletionProvider implements vscode.CompletionItemProvider {
	constructor(private readonly index: ModelIndex) {}

	async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.CompletionItem[]> {
		const text = document.getText();
		const context = contextAt(text, document.offsetAt(position));

		if (context === "capability") {
			return this.capabilityItems(document, position);
		}
		if (context === "queries") {
			return [...queryItems(), ...(await this.constantItems(document, token))];
		}
		if (context === "arguments") {
			return [...primitiveItems(), ...(await this.constantItems(document, token))];
		}
		if (context === "principal") {
			return [
				...principalItems(),
				...primitiveItems(),
				...(await this.constantItems(document, token))
			];
		}
		return topLevelItems();
	}

	/** Only the assumptions the primitive at the cursor declares. */
	private capabilityItems(
		document: vscode.TextDocument,
		position: vscode.Position
	): vscode.CompletionItem[] {
		const prefix = document.getText(
			new vscode.Range(new vscode.Position(position.line, 0), position)
		);
		const opener = prefix.match(/\b([A-Za-z][A-Za-z0-9_]*)\s*\[[^\]]*$/);
		const primitive = opener ? lookupPrimitive(opener[1]) : undefined;
		const declared: string[] = primitive ? primitive.capabilities : [];
		const allowed = primitive
			? CAPABILITIES.filter((c) => c.name === "from" || declared.includes(c.name))
			: CAPABILITIES;

		return allowed.map((capability) => {
			const item = new vscode.CompletionItem(
				capability.name,
				vscode.CompletionItemKind.Keyword
			);
			item.detail = capability.eg;
			item.documentation = new vscode.MarkdownString(capability.help);
			if (capability.name === "from") {
				item.insertText = new vscode.SnippetString("from phase ${1:1}");
			}
			return item;
		});
	}

	/** Constant names the model already binds, so a query can refer to one. */
	private async constantItems(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): Promise<vscode.CompletionItem[]> {
		const knowledgeMap = await this.index.knowledgeMap(document);
		if (token.isCancellationRequested || !knowledgeMap) {
			return [];
		}
		return knowledgeMap.Constants.map((constant, i) => {
			const item = new vscode.CompletionItem(
				constant.Name,
				vscode.CompletionItemKind.Variable
			);
			item.detail = knowledgeMap.Assigned[i] ?? "";
			const creator = knowledgeMap.Creator[i];
			if (creator) {
				item.documentation = new vscode.MarkdownString(`Created by **${creator}**.`);
			}
			// Sort constants after the language's own vocabulary.
			item.sortText = `z${constant.Name}`;
			return item;
		});
	}
}

function primitiveSnippet(p: Primitive): vscode.SnippetString {
	const args = p.args
		.slice(0, p.arity[0])
		.map((name, i) => `\${${i + 1}:${name}}`)
		.join(", ");
	return new vscode.SnippetString(`${p.name}(${args})`);
}

function primitiveItems(): vscode.CompletionItem[] {
	return PRIMITIVES.map((primitive) => {
		const item = new vscode.CompletionItem(
			primitive.name,
			vscode.CompletionItemKind.Function
		);
		item.insertText = primitiveSnippet(primitive);
		item.detail = primitive.eg;
		item.documentation = new vscode.MarkdownString(
			`${primitive.help}\n\n*${primitiveNotes(primitive)}*`
		);
		return item;
	});
}

function queryItems(): vscode.CompletionItem[] {
	const snippets: Record<string, string> = {
		confidentiality: "confidentiality? ${1:value}",
		authentication: "authentication? ${1:Alice} -> ${2:Bob}: ${3:value}",
		freshness: "freshness? ${1:value}",
		unlinkability: "unlinkability? ${1:a}, ${2:b}",
		equivalence: "equivalence? ${1:a}, ${2:b}",
		precondition: "precondition[ ${1:Bob} -> ${2:Alice}: ${3:ack} ]"
	};
	return QUERIES.map((query) => {
		const item = new vscode.CompletionItem(query.name, vscode.CompletionItemKind.Keyword);
		item.insertText = new vscode.SnippetString(snippets[query.name] ?? query.name);
		item.detail = query.eg;
		item.documentation = new vscode.MarkdownString(query.help);
		return item;
	});
}

function keyword(label: string, insert: string, detail: string): vscode.CompletionItem {
	const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword);
	item.insertText = new vscode.SnippetString(insert);
	item.detail = detail;
	return item;
}

function principalItems(): vscode.CompletionItem[] {
	return [
		keyword("knows private", "knows private ${1:value}", "A value only this principal holds"),
		keyword("knows public", "knows public ${1:value}", "A value everyone, including the attacker, holds"),
		keyword("knows password", "knows password ${1:value}", "A low-entropy value; pass it through PW_HASH"),
		keyword("generates", "generates ${1:value}", "A freshly generated value"),
		keyword("leaks", "leaks ${1:value}", "Hands the value to the attacker")
	];
}

function topLevelItems(): vscode.CompletionItem[] {
	return [
		keyword("attacker", "attacker[${1|active,passive|}]", "Declares the attacker model"),
		keyword("principal", "principal ${1:Alice}[\n\t$0\n]", "Declares a block of principal operations"),
		keyword("phase", "phase[${1:1}]", "Opens a new phase"),
		keyword("queries", "queries[\n\t$0\n]", "The block of security queries"),
		keyword("message", "${1:Alice} -> ${2:Bob}: ${3:value}", "Sends values over the wire")
	];
}

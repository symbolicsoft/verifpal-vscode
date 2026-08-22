/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import ModelIndex from "./ModelIndex";
import { constantInfo, type ConstantInfo } from "./VerifpalLib";
import {
	lookupCapability,
	lookupKeyword,
	lookupPrimitive,
	lookupQuery,
	primitiveNotes,
	type Documented
} from "./spec";

/**
 * Documentation and model insight under the cursor.
 *
 * The language's own vocabulary — primitives, queries, weakening assumptions,
 * keywords — is answered from the static spec without touching the binary, so
 * hovering keeps working on a model that does not parse. That is exactly when
 * a modeller is most likely to be reading documentation, and the old provider
 * failed the whole hover in that case because it insisted on a knowledge map
 * first.
 */
export default class HoverProvider implements vscode.HoverProvider {
	constructor(private readonly index: ModelIndex) {}

	async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.Hover | undefined> {
		const range = document.getWordRangeAtPosition(position);
		if (!range) {
			return undefined;
		}
		const word = document.getText(range);

		const primitive = lookupPrimitive(word);
		if (primitive) {
			return documented(
				"Verifpal primitive",
				{ name: primitive.name, eg: primitive.eg, help: primitive.help },
				range,
				primitiveNotes(primitive)
			);
		}
		const capability = lookupCapability(word);
		if (capability) {
			return documented("Verifpal weakening assumption", capability, range);
		}
		const query = lookupQuery(word);
		if (query) {
			return documented("Verifpal query", query, range);
		}
		const keyword = lookupKeyword(word);
		if (keyword) {
			return documented("Verifpal keyword", keyword, range);
		}

		const knowledgeMap = await this.index.knowledgeMap(document);
		if (token.isCancellationRequested || !knowledgeMap) {
			return undefined;
		}
		const info = constantInfo(word, knowledgeMap);
		if (!info) {
			return undefined;
		}
		return new vscode.Hover(constantMarkdown(info), range);
	}
}

function documented(
	title: string,
	item: Documented,
	range: vscode.Range,
	notes?: string
): vscode.Hover {
	const md = new vscode.MarkdownString();
	md.appendMarkdown(`**${title}**\n\n`);
	md.appendCodeblock(item.eg, "verifpal");
	md.appendMarkdown(`${item.help}`);
	if (notes) {
		md.appendMarkdown(`\n\n*${notes}*`);
	}
	return new vscode.Hover(md, range);
}

function constantMarkdown(info: ConstantInfo): vscode.MarkdownString {
	const md = new vscode.MarkdownString();
	md.appendMarkdown(`**Verifpal constant** \`${info.Name}\`\n\n`);
	md.appendCodeblock(
		info.Assigned && info.Assigned !== info.Name
			? `${info.Name} = ${info.Assigned}`
			: info.Name,
		"verifpal"
	);
	const facts: string[] = [];
	if (info.Creator) {
		facts.push(`Created by **${info.Creator}**`);
	}
	if (info.KnownBy.length > 0) {
		const knownBy = info.KnownBy.map(({ recipient, sender }) =>
			recipient === sender ? recipient : `${recipient} (from ${sender})`
		);
		facts.push(`Known by ${knownBy.join(", ")}`);
	}
	if (info.Phases.length > 0) {
		facts.push(`Sent in ${info.Phases.length === 1 ? "phase" : "phases"} ${info.Phases.join(", ")}`);
	}
	md.appendMarkdown(facts.join(" · "));
	return md;
}

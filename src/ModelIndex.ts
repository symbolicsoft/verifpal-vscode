/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import { getKnowledgeMap, type KnowledgeMap } from "./VerifpalLib";
import { parseModelErrors, type ModelError } from "./parse";
import { VerifpalRunError } from "./process";

/** What Verifpal makes of a model at one particular revision. */
export type ModelState =
	| { kind: "ok"; knowledgeMap: KnowledgeMap }
	| { kind: "invalid"; errors: ModelError[]; message: string }
	| { kind: "unavailable"; error: VerifpalRunError };

interface CacheEntry {
	version: number;
	state: Promise<ModelState>;
	abort: AbortController;
}

/**
 * One `knowledgeMap` run per document revision, shared by everything that
 * needs it.
 *
 * Hover, completion and live validation all want the same answer to the same
 * question — what does Verifpal make of the text as it currently stands — and
 * each was previously willing to spawn its own process to get it. Keying the
 * result on the document version collapses that to one invocation per edit,
 * and makes a stale answer impossible: a new version simply misses the cache.
 */
export default class ModelIndex implements vscode.Disposable {
	private readonly entries = new Map<string, CacheEntry>();

	/**
	 * The state of `document` at its current version, computing it if needed.
	 * Concurrent callers at the same version share one invocation.
	 */
	load(document: vscode.TextDocument): Promise<ModelState> {
		const key = document.uri.toString();
		const cached = this.entries.get(key);
		if (cached && cached.version === document.version) {
			return cached.state;
		}
		cached?.abort.abort();

		const abort = new AbortController();
		const text = document.getText();
		const state = getKnowledgeMap(text, abort.signal)
			.then<ModelState>((knowledgeMap) => ({ kind: "ok", knowledgeMap }))
			.catch<ModelState>((error: unknown) => {
				if (error instanceof VerifpalRunError && error.isModelError) {
					return {
						kind: "invalid",
						errors: parseModelErrors(error.stderr),
						message: error.message
					};
				}
				const run = error instanceof VerifpalRunError
					? error
					: new VerifpalRunError("exit", String(error), {});
				return { kind: "unavailable", error: run };
			});

		this.entries.set(key, { version: document.version, state, abort });
		return state;
	}

	/** The cached knowledge map, if the document last parsed cleanly. */
	async knowledgeMap(document: vscode.TextDocument): Promise<KnowledgeMap | undefined> {
		const state = await this.load(document);
		return state.kind === "ok" ? state.knowledgeMap : undefined;
	}

	forget(uri: vscode.Uri): void {
		const key = uri.toString();
		this.entries.get(key)?.abort.abort();
		this.entries.delete(key);
	}

	clear(): void {
		for (const entry of this.entries.values()) {
			entry.abort.abort();
		}
		this.entries.clear();
	}

	dispose(): void {
		this.clear();
	}
}

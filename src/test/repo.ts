/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as fs from "fs";
import * as path from "path";

/**
 * Shared plumbing for the test suites: where the repository is, and a typed
 * view of the extension manifest.
 *
 * Tests are compiled by the main tsconfig, so this file always lands at
 * `out/test/repo.js` regardless of which suite imports it, which makes the
 * repository root two levels up from `__dirname`.
 */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export function repoPath(...segments: string[]): string {
	return path.join(REPO_ROOT, ...segments);
}

export function repoRead(...segments: string[]): string {
	return fs.readFileSync(repoPath(...segments), "utf8");
}

export interface LanguageContribution {
	id: string;
	aliases?: string[];
	extensions?: string[];
	configuration?: string;
}

export interface GrammarContribution {
	language: string;
	scopeName: string;
	path: string;
}

export interface SnippetContribution {
	language: string;
	path: string;
}

export interface CommandContribution {
	command: string;
	title: string;
	category?: string;
	icon?: string;
}

export interface MenuContribution {
	command: string;
	when?: string;
	group?: string;
}

export interface ConfigurationProperty {
	type: string | string[];
	default?: unknown;
	description?: string;
	markdownDescription?: string;
	scope?: string;
	minimum?: number;
	maximum?: number;
}

export interface SemanticTokenScopeContribution {
	language: string;
	scopes: Record<string, string[]>;
}

export interface Manifest {
	name: string;
	displayName: string;
	version: string;
	publisher: string;
	main: string;
	icon: string;
	engines: { vscode: string };
	devDependencies: Record<string, string>;
	dependencies: Record<string, string>;
	scripts: Record<string, string>;
	capabilities?: {
		untrustedWorkspaces?: {
			supported: string | boolean;
			description?: string;
			restrictedConfigurations?: string[];
		};
	};
	contributes: {
		languages: LanguageContribution[];
		grammars: GrammarContribution[];
		snippets: SnippetContribution[];
		commands: CommandContribution[];
		menus: Record<string, MenuContribution[]>;
		configuration: {
			type: string;
			title: string;
			properties: Record<string, ConfigurationProperty>;
		};
		semanticTokenScopes?: SemanticTokenScopeContribution[];
	};
}

let cached: Manifest | undefined;

/** The extension manifest, read from disk and parsed once. */
export function manifest(): Manifest {
	if (!cached) {
		cached = JSON.parse(repoRead("package.json")) as Manifest;
	}
	return cached;
}

/** The extension's own identifier, as the Marketplace and VS Code know it. */
export function extensionId(): string {
	const m = manifest();
	return `${m.publisher}.${m.name}`;
}

/** Every command id the manifest declares. */
export function declaredCommands(): string[] {
	return manifest().contributes.commands.map((c) => c.command);
}

/** Every setting id the manifest declares. */
export function declaredSettings(): string[] {
	return Object.keys(manifest().contributes.configuration.properties);
}

export const SAMPLE_MODEL = path.join("src", "test", "fixtures", "sample.vp");

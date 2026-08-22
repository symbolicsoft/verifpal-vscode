/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as assert from "assert";
import * as fs from "fs";
import {
	declaredCommands,
	declaredSettings,
	manifest,
	repoPath,
	repoRead
} from "../repo";

/**
 * Checks the manifest against what is actually on disk.
 *
 * Every one of these can break without a compile error: a renamed asset, a
 * menu entry pointing at a command that no longer exists, a setting listed as
 * restricted in an untrusted workspace after it was renamed. VS Code responds
 * to all of them by quietly dropping the contribution.
 */

function exists(...segments: string[]): boolean {
	return fs.existsSync(repoPath(...segments));
}

/** Resolves a manifest-relative path such as "./syntax/verifpal.tmLanguage". */
function fromManifest(relative: string): string {
	return repoPath(relative.replace(/^\.\//, ""));
}

describe("manifest identity", () => {
	it("carries a semantic version", () => {
		assert.match(manifest().version, /^\d+\.\d+\.\d+$/);
	});

	it("names a publisher and a display name", () => {
		assert.ok(manifest().publisher.length > 0);
		assert.ok(manifest().displayName.length > 0);
	});

	it("points main at the file esbuild actually writes", () => {
		const outfile = /outfile:\s*"([^"]+)"/.exec(repoRead("esbuild.js"));
		assert.ok(outfile, "could not find an outfile in esbuild.js");
		const bundled = outfile[1].replace(/^\.\//, "");
		const entry = manifest().main.replace(/^\.\//, "");
		assert.strictEqual(
			entry,
			bundled,
			"package.json 'main' and the esbuild bundle have drifted apart"
		);
	});

	it("ships an icon that exists", () => {
		assert.ok(exists(manifest().icon), `${manifest().icon} is missing`);
	});

	it("declares an engine range matching the @types/vscode it builds against", () => {
		const engine = /(\d+)\.(\d+)/.exec(manifest().engines.vscode);
		const types = /(\d+)\.(\d+)/.exec(manifest().devDependencies["@types/vscode"]);
		assert.ok(engine && types);
		assert.strictEqual(
			`${engine[1]}.${engine[2]}`,
			`${types[1]}.${types[2]}`,
			"engines.vscode and @types/vscode target different VS Code versions"
		);
	});
});

describe("language contribution", () => {
	const languages = manifest().contributes.languages;

	it("declares the verifpal language and claims .vp", () => {
		const language = languages.find((entry) => entry.id === "verifpal");
		assert.ok(language, "no 'verifpal' language is contributed");
		assert.ok(language.extensions?.includes(".vp"), "the language does not claim .vp");
	});

	it("points at a language configuration that parses", () => {
		for (const language of languages) {
			assert.ok(language.configuration, `${language.id} has no language configuration`);
			const file = fromManifest(language.configuration);
			assert.ok(fs.existsSync(file), `${language.configuration} is missing`);
			JSON.parse(fs.readFileSync(file, "utf8"));
		}
	});

	it("contributes grammars for declared languages only", () => {
		const ids = languages.map((language) => language.id);
		for (const grammar of manifest().contributes.grammars) {
			assert.ok(ids.includes(grammar.language), `grammar targets unknown '${grammar.language}'`);
			assert.ok(fs.existsSync(fromManifest(grammar.path)), `${grammar.path} is missing`);
			assert.ok(grammar.scopeName.length > 0);
		}
	});

	it("contributes snippets for declared languages only", () => {
		const ids = languages.map((language) => language.id);
		for (const snippet of manifest().contributes.snippets) {
			assert.ok(ids.includes(snippet.language), `snippets target unknown '${snippet.language}'`);
			assert.ok(fs.existsSync(fromManifest(snippet.path)), `${snippet.path} is missing`);
		}
	});

	it("maps semantic token scopes for declared languages only", () => {
		const ids = manifest().contributes.languages.map((language) => language.id);
		for (const entry of manifest().contributes.semanticTokenScopes ?? []) {
			assert.ok(ids.includes(entry.language));
			for (const [token, scopes] of Object.entries(entry.scopes)) {
				assert.ok(scopes.length > 0, `semantic token '${token}' maps to no scope`);
			}
		}
	});
});

describe("commands and menus", () => {
	it("gives every command a unique, namespaced id", () => {
		const commands = declaredCommands();
		assert.deepStrictEqual(
			commands,
			[...new Set(commands)],
			"a command id is declared more than once"
		);
		for (const command of commands) {
			assert.ok(command.startsWith("verifpal."), `${command} is not namespaced`);
		}
	});

	it("gives every command a title and a category", () => {
		for (const command of manifest().contributes.commands) {
			assert.ok(command.title.length > 0, `${command.command} has no title`);
			assert.strictEqual(command.category, "Verifpal", `${command.command} is miscategorised`);
		}
	});

	it("only references declared commands from menus", () => {
		const commands = new Set(declaredCommands());
		for (const [menu, entries] of Object.entries(manifest().contributes.menus)) {
			for (const entry of entries) {
				assert.ok(
					commands.has(entry.command),
					`${menu} references undeclared command '${entry.command}'`
				);
			}
		}
	});

	it("guards every menu entry with a when clause", () => {
		for (const [menu, entries] of Object.entries(manifest().contributes.menus)) {
			for (const entry of entries) {
				assert.ok(
					entry.when && entry.when.length > 0,
					`${menu} shows '${entry.command}' unconditionally`
				);
			}
		}
	});
});

describe("configuration contribution", () => {
	const properties = manifest().contributes.configuration.properties;

	it("namespaces every setting", () => {
		for (const setting of Object.keys(properties)) {
			assert.ok(setting.startsWith("verifpal."), `${setting} is not namespaced`);
		}
	});

	it("documents and scopes every setting, and gives it a default", () => {
		for (const [setting, property] of Object.entries(properties)) {
			assert.ok(
				property.description || property.markdownDescription,
				`${setting} has no description`
			);
			assert.ok(property.scope, `${setting} has no scope`);
			assert.ok("default" in property, `${setting} has no default`);
		}
	});

	it("bounds every numeric setting", () => {
		for (const [setting, property] of Object.entries(properties)) {
			const types = Array.isArray(property.type) ? property.type : [property.type];
			if (types.includes("number")) {
				assert.strictEqual(typeof property.minimum, "number", `${setting} has no minimum`);
				assert.strictEqual(typeof property.maximum, "number", `${setting} has no maximum`);
			}
		}
	});

	it("restricts only settings that exist in untrusted workspaces", () => {
		const restricted = manifest().capabilities?.untrustedWorkspaces?.restrictedConfigurations ?? [];
		assert.ok(restricted.length > 0, "no setting is restricted in untrusted workspaces");
		for (const setting of restricted) {
			assert.ok(
				declaredSettings().includes(setting),
				`'${setting}' is restricted but not declared`
			);
		}
	});

	it("restricts the binary path, which is the one that executes code", () => {
		const restricted = manifest().capabilities?.untrustedWorkspaces?.restrictedConfigurations ?? [];
		assert.ok(
			restricted.includes("verifpal.path"),
			"verifpal.path must stay restricted: a workspace could otherwise choose the binary to run"
		);
	});
});

describe("diagram webview assets", () => {
	const template = repoRead("res", "diagram.html");
	// The provider names some placeholders inside regular expressions, where
	// the dollars are escaped; dropping backslashes lets one pattern find all
	// of them.
	const provider = repoRead("src", "DiagramProvider.ts").replace(/\\/g, "");
	const placeholders = (source: string): Set<string> =>
		new Set([...source.matchAll(/\$\$([A-Z0-9]+)\$\$/g)].map((match) => match[1]));

	it("keeps every placeholder DiagramProvider substitutes", () => {
		const substituted = placeholders(provider);
		assert.ok(substituted.size > 0, "DiagramProvider substitutes nothing");
		for (const placeholder of substituted) {
			assert.ok(
				template.includes(`$$${placeholder}$$`),
				`diagram.html no longer contains $$${placeholder}$$`
			);
		}
	});

	it("leaves no placeholder in the template unsubstituted", () => {
		const substituted = placeholders(provider);
		for (const placeholder of placeholders(template)) {
			assert.ok(
				substituted.has(placeholder),
				`diagram.html contains $$${placeholder}$$, which DiagramProvider never fills in`
			);
		}
	});

	it("ships every script the provider resolves", () => {
		const assets = [...provider.matchAll(/asset\("([^"]+)"\)/g)].map((match) => match[1]);
		assert.strictEqual(assets.length, 4, "expected four vendored webview scripts");
		for (const asset of assets) {
			assert.ok(exists("res", asset), `res/${asset} is missing`);
		}
	});

	it("loads no resource from outside the extension", () => {
		for (const match of template.matchAll(/(?:src|href)="([^"]*)"/g)) {
			const value = match[1];
			assert.ok(
				value.startsWith("$$"),
				`diagram.html loads '${value}', which the content security policy forbids`
			);
		}
	});
});

describe("packaging", () => {
	const ignored = repoRead(".vscodeignore").split(/\r?\n/).map((line) => line.trim());

	it("keeps sources and test output out of the vsix", () => {
		for (const pattern of ["src/**", "out/**", "node_modules/**"]) {
			assert.ok(ignored.includes(pattern), `.vscodeignore no longer excludes ${pattern}`);
		}
	});

	it("references no file it does not have", () => {
		for (const pattern of ignored) {
			if (!pattern || pattern.startsWith("#") || pattern.includes("*")) {
				continue;
			}
			assert.ok(exists(pattern), `.vscodeignore excludes '${pattern}', which does not exist`);
		}
	});
});

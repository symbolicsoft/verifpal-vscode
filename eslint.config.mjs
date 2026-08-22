// SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
// SPDX-License-Identifier: GPL-3.0-only

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		// "res" holds vendored, minified third-party libraries for the diagram
		// webview; they are not ours to lint.
		// ".vscode-test" holds a downloaded VS Code build, nearly a gigabyte of
		// minified JavaScript. Walking into it exhausts the heap.
		ignores: [
			".vscode-test/**",
			"dist/**",
			"out/**",
			"node_modules/**",
			"res/**",
			"esbuild.js"
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module"
		},
		rules: {
			"indent": ["error", "tab"],
			"linebreak-style": ["error", "unix"],
			"quotes": ["error", "double"],
			"semi": ["error", "always"]
		}
	},
	{
		// Config files at the repository root are plain ESM run by Node, not
		// by the extension host, so they see Node's globals.
		files: ["*.mjs"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				process: "readonly"
			}
		},
		rules: {
			"indent": ["error", "tab"],
			"linebreak-style": ["error", "unix"],
			"quotes": ["error", "double"],
			"semi": ["error", "always"]
		}
	}
);

// SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
// SPDX-License-Identifier: GPL-3.0-only

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		// "res" holds vendored, minified third-party libraries for the diagram
		// webview; they are not ours to lint.
		ignores: ["dist/**", "out/**", "node_modules/**", "res/**", "esbuild.js"]
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
	}
);

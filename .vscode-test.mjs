// SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
// SPDX-License-Identifier: GPL-3.0-only

import { defineConfig } from "@vscode/test-cli";

// The VS Code build to test against. CI sets this to pin the oldest version
// the manifest claims to support as well as the current stable one.
const version = process.env.VSCODE_VERSION || "stable";

const shared = {
	version,
	// Opening the fixture directory gives the tests a workspace and a model.
	workspaceFolder: "./src/test/fixtures",
	launchArgs: ["--disable-extensions", "--disable-gpu"],
	mocha: {
		ui: "bdd",
		timeout: 30000,
		color: false
	}
};

export default defineConfig([
	{
		// A pristine instance: these tests need the extension still dormant,
		// so nothing that would activate it may have run first.
		...shared,
		label: "activation",
		files: "out/test/suite/activation/**/*.test.js"
	},
	{
		...shared,
		label: "integration",
		files: "out/test/suite/*.test.js"
	}
]);

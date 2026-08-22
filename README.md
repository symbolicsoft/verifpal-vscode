<!---
# SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Verifpal for Visual Studio Code

[![CI](https://github.com/symbolicsoft/verifpal-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/symbolicsoft/verifpal-vscode/actions/workflows/ci.yml)

## What is Verifpal for Visual Studio Code?
Verifpal for Visual Studio Code is an extension that provides IDE features for the [Verifpal](https://verifpal.com) protocol modeling and analysis software within the popular Microsoft [Visual Studio Code](https://code.visualstudio.com/) editor. It is an official extension that is developed and maintained by the Verifpal project.

**Verifpal for Visual Studio Code requires Verifpal 1.1 or higher, and Visual Studio Code 1.82 or higher.** The extension is a client of `verifpal lsp`, the language server built into the Verifpal binary, so what it reports is exactly what the command line would report on the same model — there is one implementation of the language, and it is the engine's.

**Features**

- Syntax highlighting, refined by semantic tokens from the engine's own parser: a constant is coloured as a constant because the parser bound one there, not because a regex matched.
- Live error checking as you type: parse and sanity errors appear in the Problems panel, underlined on the line and column Verifpal objected to, with the engine's own notes and any secondary location attached.
- Attacker analysis from within the editor, with a progress indicator, cancellation, failed queries and their attack traces in the Problems panel, and a full written record in the Verifpal Analysis output pane.
- Formatting, including format-on-save, driven by Verifpal's own canonical formatter.
- Documentation and model insight on hover: every primitive, query, weakening assumption and keyword, plus the creator, assigned value, recipients and phases of any constant.
- Completions scoped to where you are in the model, with signature help naming each primitive's arguments in order.
- Go to Definition, Find All References, Rename Symbol and document highlights for constants and principals — exact, because Verifpal forbids introducing a name twice.
- An outline of the model: principals, the values each binds, messages, phases and queries, for the Outline view, breadcrumbs and `Go to Symbol`.
- Folding driven by the model's real structure, so a guarded value (`[ga]`) and a capability parameter (`SIGN[forgeable]`) create no folds.
- Inlay hints naming each primitive argument at its call site, and a "Run attacker analysis" action above the queries block.
- Snippets for the usual scaffolding, from a whole model down to a delayed weakening assumption.
- Live diagram visualizations of Verifpal models within Visual Studio Code.

## Getting Started
To install Verifpal for Visual Studio Code, simply search for it within the extensions search functionality of your Visual Studio Code Editor.

Syntax highlighting and error checking are available immediately on `.vp` files. To format a model, right-click within the editor and select _"Format Document"_.

Hovering over primitives (such as `HKDF` or `AEAD_ENC`) shows documentation for these primitives, including their argument and output counts, whether they may be suffixed with `?`, and which weakening assumptions they accept. Hovering over constants shows their assigned values, the principal that created them, and who received them. Hovering over queries, weakening assumptions (`weak`, `forgeable`, `malleable`) and language keywords shows what each one means.

To analyze a model, open the Command Palette (`Ctrl+Shift+P` on Windows and Linux, `⌘+Shift+P` on macOS) and run _"Verifpal: Run Attacker Analysis"_, or right-click in the editor. Failed queries appear in the Problems panel with their attack traces; the Verifpal Analysis output pane holds the full record. Analysis is cancellable from its progress notification, so a model that turns out to be expensive no longer means waiting it out.

By default Verifpal analyses each principal running two concurrent sessions. **A query that holds is a query for which no attack was found within that bound, not one that holds in general.** Session replication costs roughly four times the work, so `verifpal.sessions` lets you drop to `1` for a model too large to afford it. The analysis runs in the server, not in the editor, so you can keep editing while it works.

To show a diagram visualizing your protocol, run _"Verifpal: Show Protocol Diagram"_ from the Command Palette or the editor title bar. The diagram tracks the model it was opened for and redraws whenever that model is saved.

Verifpal for Visual Studio Code may be configured via the following options in your Visual Studio Code User Settings file:

- `verifpal.enabled`: enables or disables IDE features. Takes effect immediately. (eg. `true`)
- `verifpal.path`: sets the path for the Verifpal binary on your computer. (eg. `/usr/local/bin/verifpal`)
- `verifpal.validateOnType`: checks models for errors as you type rather than only on save. (eg. `true`)
- `verifpal.analyzeOnSave`: runs a full attacker analysis every time a model is saved. Off by default, since analysis can be slow. (eg. `false`)
- `verifpal.sessions`: sessions per principal for the analysis. Leave unset for Verifpal's own default of 2. (eg. `1`)
- `verifpal.diagnostics.passing`: also mark queries that hold, as informational entries. (eg. `true`)
- `verifpal.inlayHints.argumentNames`: show primitive argument names inline. (eg. `true`)
- `verifpal.codeLens`: show a "Run attacker analysis" action above the queries block. (eg. `true`)

**Note**: If `verifpal.path` is left empty, the extension invokes `verifpal` from your `PATH`. Set it explicitly if you have installed Verifpal somewhere that your editor's environment does not search. In an untrusted workspace, a workspace-level `verifpal.path` is ignored: opening a repository should not by itself cause an executable of that repository's choosing to be run.

## Contributing
```sh
make dependencies   # npm ci
make build          # bundle into dist/
make lint           # eslint + tsc --noEmit
make check          # what CI runs
```

The extension no longer has unit tests, because it no longer has anything to unit test. It used to carry a scanner for the Verifpal language and a copy of the engine's primitive table, and the tests existed to catch those drifting — the extension once documented `malleable` as unimplemented long after `ENC[malleable]` started working, and nothing caught it. Both are now gone: the language lives in the engine, and the extension asks. What is left is glue, and it is exercised by the language server's own test suite in the Verifpal repository.

## Discussion
Sign up to the [Verifpal Mailing List](https://lists.symbolic.software/mailman/listinfo/verifpal) to stay informed on the latest news and announcements regarding Verifpal, and to participate in Verifpal discussions.

## License
Verifpal and Verifpal for Visual Studio Code are published by Symbolic Software. They are provided as free and open source software, licensed under the [GNU General Public License, version 3](https://www.gnu.org/licenses/gpl-3.0.en.html). The Verifpal User Manual is provided under the [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/) license.

© Copyright 2019-2026 Nadim Kobeissi. All Rights Reserved. “Verifpal” and the “Verifpal” logo/mascot are registered trademarks of Nadim Kobeissi.

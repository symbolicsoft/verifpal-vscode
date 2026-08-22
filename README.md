<!---
# SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Verifpal for Visual Studio Code

[![](https://img.youtube.com/vi/it_hJkVU-UA/0.jpg)](http://www.youtube.com/watch?v=it_hJkVU-UA "Verifpal for Visual Studio Code")

## What is Verifpal for Visual Studio Code?
Verifpal for Visual Studio Code is an extension that provides IDE features for the [Verifpal](https://verifpal.com) protocol modeling and analysis software within the popular Microsoft [Visual Studio Code](https://code.visualstudio.com/) editor. It is an official extension that is developed and maintained by the Verifpal project.

**Verifpal for Visual Studio Code requires Verifpal 1.0.0 or higher to be installed.** It talks to the `verifpal` binary on your machine, so what it reports is exactly what the command line would report on the same model.

**Features**

- Syntax highlighting for Verifpal models.
- Live error checking as you type: parse and sanity errors appear in the Problems panel, underlined on the line and column Verifpal objected to.
- Attacker analysis from within the editor, with a cancellable progress indicator, failed queries and their attack traces in the Problems panel, and a full written record in the Verifpal Analysis output pane.
- Formatting using the standard Visual Studio Code API, including format-on-save, driven by Verifpal's own canonical formatter.
- Documentation and model insight on hover: every primitive, query, weakening assumption and keyword, plus the creator, assigned value and recipients of any constant.
- Completions scoped to where you are in the model, with signature help naming each primitive's arguments in order.
- An outline of the model: principals, the values each binds, messages, phases and queries, for the Outline view, breadcrumbs and `Go to Symbol`.
- Snippets for the usual scaffolding, from a whole model down to a delayed weakening assumption.
- Live diagram visualizations of Verifpal models within Visual Studio Code.

## Getting Started
To install Verifpal for Visual Studio Code, simply search for it within the extensions search functionality of your Visual Studio Code Editor.

Syntax highlighting and error checking are available immediately on `.vp` files. To format a model, right-click within the editor and select _"Format Document"_.

Hovering over primitives (such as `HKDF` or `AEAD_ENC`) shows documentation for these primitives, including their argument and output counts, whether they may be suffixed with `?`, and which weakening assumptions they accept. Hovering over constants shows their assigned values, the principal that created them, and who received them. Hovering over queries, weakening assumptions (`weak`, `forgeable`, `malleable`) and language keywords shows what each one means.

To analyze a model, open the Command Palette (`Ctrl+Shift+P` on Windows and Linux, `⌘+Shift+P` on macOS) and run _"Verifpal: Run Attacker Analysis"_, or right-click in the editor. Failed queries appear in the Problems panel with their attack traces; the Verifpal Analysis output pane holds the full record. Analysis is cancellable from its progress notification, so a model that turns out to be expensive no longer means waiting it out.

Note that Verifpal analyses each principal running two concurrent sessions, and that the editor interface has no way to change that. **A query that holds is a query for which no attack was found within that bound, not one that holds in general.** For a model large enough that this matters, or one that takes a long time, the command line remains the better workflow: it lets you pass `--sessions`, and it lets you keep editing while an analysis runs.

To show a diagram visualizing your protocol, run _"Verifpal: Show Protocol Diagram"_ from the Command Palette or the editor title bar. The diagram tracks the model it was opened for and redraws whenever that model is saved.

Verifpal for Visual Studio Code may be configured via the following options in your Visual Studio Code User Settings file:

- `verifpal.enabled`: enables or disables IDE features. Takes effect immediately. (eg. `true`)
- `verifpal.path`: sets the path for the Verifpal binary on your computer. (eg. `/usr/local/bin/verifpal`)
- `verifpal.validateOnType`: checks models for errors as you type rather than only on save. (eg. `true`)
- `verifpal.analyzeOnSave`: runs a full attacker analysis every time a model is saved. Off by default, since analysis can be slow. (eg. `false`)

**Note**: If `verifpal.path` is left empty, the extension invokes `verifpal` from your `PATH`. Set it explicitly if you have installed Verifpal somewhere that your editor's environment does not search. In an untrusted workspace, a workspace-level `verifpal.path` is ignored: opening a repository should not by itself cause an executable of that repository's choosing to be run.

## Contributing
```sh
make dependencies   # npm ci
make build          # bundle into dist/
make lint           # eslint + tsc --noEmit
make test           # unit tests
make check          # lint and test, which is what CI runs
```

The tests cover the parts of the extension that are pure: reading Verifpal's output, scanning model text, and the language tables in `src/spec.ts`. Those tables mirror the engine's `src/primitive/spec.rs` and `src/capability.rs`, and the tests assert that they still match — the extension once documented `malleable` as unimplemented long after `ENC[malleable]` started working, and nothing caught it.

## Discussion
Sign up to the [Verifpal Mailing List](https://lists.symbolic.software/mailman/listinfo/verifpal) to stay informed on the latest news and announcements regarding Verifpal, and to participate in Verifpal discussions.

## License
Verifpal and Verifpal for Visual Studio Code are published by Symbolic Software. They are provided as free and open source software, licensed under the [GNU General Public License, version 3](https://www.gnu.org/licenses/gpl-3.0.en.html). The Verifpal User Manual is provided under the [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/) license.

© Copyright 2019-2026 Nadim Kobeissi. All Rights Reserved. “Verifpal” and the “Verifpal” logo/mascot are registered trademarks of Nadim Kobeissi.

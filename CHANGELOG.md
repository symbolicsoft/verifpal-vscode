<!---
# SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Change Log

## 1.1.0

**Correctness**

- `malleable` was documented as reserved and unimplemented. It is implemented: `ENC[malleable]` lets the attacker retarget a ciphertext it already holds into another the recipient still accepts, under a key it never learns. The hover now says so, and a test now pins the extension's language tables against the engine's, so the next such drift fails the build rather than shipping.
- Constants bound by an assignment are now highlighted, and the anonymous constant `_` keeps its own styling among them. Only unindented lines were reached before, so every assignment target inside a principal block went unstyled.
- Primitive names are now highlighted whichever case they are written in, as the parser resolves them.
- Corrected the syntax highlighting of `weak`, `forgeable`, `malleable` and `from`. These are contextual keywords that Verifpal deliberately keeps out of its reserved list, so a constant may legally be named `weak`; they are now highlighted only inside a primitive's capability brackets, where no constant can appear. Primitive names are also matched case-insensitively, as the parser resolves them, and word-bounded, so the `_` inside a name like `my_value` is no longer styled as the anonymous constant.

**Live error checking**

- Parse and sanity errors now appear in the Problems panel, underlined at the exact line and column Verifpal reported, with the engine's own message. Previously every failure — a missing `queries` block, a principal using a constant it does not know, a typo in a primitive name — was collapsed into one notification reading "your model is invalid", which said that something was wrong but never what or where.
- Checking runs as you type, on a short debounce, and can be limited to save with `verifpal.validateOnType`.

**Analysis**

- Analysis now runs under a cancellable progress notification, so a model that turns out to be expensive can be abandoned. It previously ran with no way to stop it, and a hung run left the command permanently refusing to start another.
- Failed queries appear in the Problems panel carrying their attack traces, so a trace can be read next to the line it concerns. The Verifpal Analysis output pane holds the full record and is opened when there is something to see.
- One summary notification replaces the previous one-per-failed-query pile of notifications.
- The result is reported honestly: analysis runs at Verifpal's default of two concurrent sessions per principal, which the output pane now states, since a query that holds holds within that bound rather than in general.
- A status bar item shows whether the current model holds, and whether the result is conditional on a declared weakening assumption.
- Results are discarded as soon as the model is edited. Decorations used to survive the edits that invalidated them, drifting onto unrelated text.
- Constant highlighting no longer misses a constant at the start of a line or a second occurrence on the same line, and no longer marks occurrences inside comments.
- Added `verifpal.analyzeOnSave` for analysing on every save, off by default, and a "Clear Analysis Results" command.

**Stability**

- Invocations of Verifpal are now settled on process close rather than exit. Output could previously still be buffered when the extension decided the run was over, so a truncated JSON payload was reported to the user as an invalid model.
- The exit code is now honoured. A run used to be judged solely by whether anything reached stderr, so a non-zero exit with a quiet stderr passed for success, and any future warning would have failed a healthy run.
- Writing the model to a process that failed to spawn no longer raises an unhandled stream error. With Verifpal absent from `PATH`, the extension now says so once, with buttons to set `verifpal.path` or to install Verifpal.
- Parse-time invocations have a timeout, so an unresponsive binary cannot wedge the extension.
- Hovering no longer fails outright on a model with a syntax error, and no longer leaves an unhandled promise rejection behind: documentation for primitives, queries, assumptions and keywords is answered without consulting the binary at all.
- One `knowledgeMap` invocation per document revision is now shared between hover, completion and error checking, instead of each spawning its own process on every hover or keystroke.
- Fixed the protocol diagram creating a new panel on every invocation while tracking only the most recent one, so that a second panel orphaned the first and closing either left the survivor visible but unable to refresh. One panel now exists at a time and is revealed rather than duplicated.
- Fixed the diagram redrawing on the save of any document, which piped whichever file was being edited — a `.ts` file included — into Verifpal. It is now bound to the model it was opened for.
- The diagram refreshes by message rather than by rebuilding the page, so saving no longer resets scroll position, and a model that cannot be drawn explains itself in the panel instead of leaving the last drawing on screen.
- `verifpal.enabled` takes effect immediately; it previously required a window reload in both directions.
- Analysis and diagram commands now only appear, and only act, on Verifpal models.

**Language features**

- Added completions, scoped to position: keywords and message shapes at the top level, declarations and primitives inside a principal, query kinds inside `queries[…]`, and inside a primitive's brackets only the weakening assumptions that primitive actually declares — Verifpal rejects the others rather than ignoring them.
- Added signature help naming each primitive's arguments in order, which matters most for the ones that fail confusingly when transposed, such as `DH_KEX(public_key, private_key)`.
- Added a document outline covering principals and the values they bind, messages, phases and queries, so Outline, breadcrumbs and `Go to Symbol` work. The outline is lexical, so it keeps working on a model that does not parse.
- Added snippets, from a whole model skeleton down to `weakfrom` for a delayed weakening assumption.
- Hover over a primitive now states its argument and output counts, whether it accepts `?`, and which weakening assumptions it takes; hover over a constant now renders its recipients readably instead of as raw JSON; and language keywords are now documented.
- Added a word pattern, indentation rules and comment-continuation rules to the language configuration, and removed quote auto-closing, which the language has no use for.

**Security**

- `verifpal.path` is now machine-overridable and is declared as a restricted setting, so opening an untrusted workspace cannot cause the extension to run an executable that workspace chose. The extension declares limited untrusted-workspace support rather than silently doing the unsafe thing.

**Project**

- Added a unit test suite over the pure logic, run by `make test` and by CI.
- Updated dependencies.

## 1.0.12

- Add syntax highlighting and hover documentation for declared weakening assumptions, the per-call-site annotation introduced in Verifpal 0.70.0: `SIGN[forgeable](sk, m)`, `PUBKEY[weak](a)`, `AEAD_ENC[weak from phase 2](k, m, ad)`. `from` and `phase` are highlighted only when they follow a capability, since neither is a reserved constant name.
- Surface those assumptions in the analysis results. Verifpal's `internal-json` verify payload gained an `Assumptions` key on each result; the extension now lists them in the Verifpal Analysis output pane and warns that results hold only under them. An attack found under a declared assumption is genuine only under that assumption, and a passing result is conditional on it, so neither should be read as unconditional.
- Correct the documented output of `SIGNVERIF` and `RINGSIGNVERIF` from `message` to `verified`. A successful verification yields a verification token rather than the message, and the primary purpose of both is use as a checked primitive.

## 1.0.11

- Update syntax highlighting for Verifpal 0.61.0, which removes Diffie-Hellman equations: the `^` operator is gone, and `PUBKEY` and `DH_KEX` are now highlighted as primitives.
- Add syntax highlighting and hover documentation for the `KEM_ENCAP` and `KEM_DECAP` primitives, which were previously unsupported by this extension.
- Update hover documentation for `PUBKEY` and `DH_KEX`, and for the primitives that take a public key (`SIGNVERIF`, `PKE_ENC`, `RINGSIGN`, `RINGSIGNVERIF`).
- Add syntax highlighting for `/* */` block comments, which Verifpal has long accepted and preserves when formatting.
- Add syntax highlighting for `→`, which Verifpal accepts in place of `->`, and decorate analysis results on messages and queries written with it.
- Fix `equivalence?` not being highlighted as a query keyword, and `BLIND`, `UNBLIND`, `RINGSIGN` and `RINGSIGNVERIF` not being highlighted when nested inside another primitive's arguments.
- Add hover documentation for the `precondition` query option, correct the documented argument and output counts for `CONCAT`, `SPLIT`, `HASH`, `HKDF` and `PW_HASH`, and note which primitives accept the `?` suffix.

## 1.0.9

- Add support for `equivalence` queries.

## 1.0.8

- Fix a typo.

## 1.0.7

- Add support for the new `BLIND` and `UNBLIND` primitives.

## 1.0.6

- Fix diagrams being hard to read with certain VSCode themes.

## 1.0.5

- Diagrams now display properly in Visual Studio Code editors using dark themes.

## 1.0.4

- Correctly handle errors when user attempts to analyze or visualize an invalid model (due to syntax errors or similar).

## 1.0.3

- Fixed a typo.

## 1.0.2

- Fix a bug that prevented diagram visualizations for working on Windows.
- Removed a message that incessantly kept popping up asking the user to set `verifpal.path`.

## 1.0.1

- Move beyond deprecated VSCode extension APIs.
- Improve documentation.

## 1.0.0

- Add live analysis support (requires Verifpal 0.13.0 or higher).
- Add formatting support (requires Verifpal 0.13.0 or higher).
- Add hover information support (requires Verifpal 0.13.0 or higher).
- Add value peeking (requires Verifpal 0.13.0 or higher).
- Add diagram generation support (requires Verifpal 0.13.0 or higher).

## 0.0.12

- Add `freshness` and `unlinkability` query keywords.

## 0.0.11

- `SPLIT` keyword incorrectly added as `JOIN`.

## 0.0.10

- Add `CONCAT` and `JOIN` keywords.

## 0.0.9

- Add `RINGSIGN` and `RINGSIGNVERIF` keywords.

## 0.0.8

- Add `leaks` declaration keyword.

## 0.0.7

- Add `phase` block keyword.

## 0.0.6

- Added `PW_HASH` and `password` keywords.

## 0.0.5

- Added `SHAMIR_SPLIT` and `SHAMIR_JOIN` keywords.

## 0.0.4

- Added `PKE_ENC` and `PKE_DEC` keywords.

## 0.0.3

- Added `nil` and `_` keywords.

## 0.0.2

- Updated syntax highlighting to match the renaming of `HMACVERIF` to `ASSERT` and `HMAC` to `MAC`.

## 0.0.1

- Initial release.

<!---
# SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Change Log

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

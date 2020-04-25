#!/usr/bin/env bash
# SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail

echo -n "[Verifpal for Visual Studio Code] Enter version: "
read VERSION

$EDITOR CHANGELOG.md

if [[ "$OSTYPE" == "darwin"* ]]; then
	gsed -i -e "s/\"version\": \"\([0-9]\|.\)\+\"/\"version\": \"${VERSION}\"/g" package.json
else
	sed -i -e  "s/\"version\": \"\([0-9]\|.\)\+\"/\"version\": \"${VERSION}\"/g" package.json
fi

git commit -am "Verifpal for Visual Studio Code ${VERSION}" &> /dev/null
git push &> /dev/null
git tag -a "v${VERSION}" -m "Verifpal for Visual Studio Code${VERSION}" -m "${RELEASE_NOTES}" &> /dev/null
git push origin "v${VERSION}" &> /dev/null

echo "[Verifpal for Visual Studio Code] v${VERSION} tagged."

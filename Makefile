# SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: GPL-3.0-only

dependencies:
	@npm ci

clean:
	@$(RM) -rf dist out

build:
	@npm run package

lint:
	@npm run lint
	@npm run check-types

test:
	@npm test

check: lint test

publish:
	@vsce publish -p "${GITLAB_VSCE_PAN}"

tag:
	@scripts/tag.sh

.PHONY: dependencies clean build lint test check publish tag

# SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: GPL-3.0-only

dependencies:
	@npm install -g eslint typescript
	@npm install

clean:
	@$(RM) -rf out

lint:
	@eslint src/*

publish:
	@vsce publish -p "${GITLAB_VSCE_PAN}"

.PHONY: dependencies clean lint publish .vscode node_modules out src syntax

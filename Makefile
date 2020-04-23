# SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: GPL-3.0-only

dependencies:
	@npm install

clean:
	@$(RM) -rf out

publish:
	@vsce publish

.PHONY: dependencies clean publish .vscode node_modules out src syntax

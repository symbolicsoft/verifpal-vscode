# SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: GPL-3.0-only

dependencies:
	@npm install

clean:
	@$(RM) -rf out

.PHONY: dependencies clean .vscode node_modules out src syntax

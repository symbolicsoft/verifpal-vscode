/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from "vscode";
import { lookupPrimitive, primitiveNotes, type Primitive } from "./spec";

/**
 * Parameter hints inside a primitive call.
 *
 * Verifpal's primitives are strict about argument order in ways that are easy
 * to get backwards — `DH_KEX(public_key, private_key)` and
 * `SIGNVERIF(public_key, message, signature)` both fail confusingly when
 * transposed — so naming the parameter under the cursor is worth more here
 * than in a language where arguments are interchangeable.
 */
export default class SignatureProvider implements vscode.SignatureHelpProvider {
	provideSignatureHelp(
		document: vscode.TextDocument,
		position: vscode.Position
	): vscode.SignatureHelp | undefined {
		const prefix = document.getText(
			new vscode.Range(new vscode.Position(position.line, 0), position)
		);
		const call = enclosingCall(prefix);
		if (!call) {
			return undefined;
		}
		const primitive = lookupPrimitive(call.name);
		if (!primitive) {
			return undefined;
		}

		const help = new vscode.SignatureHelp();
		help.signatures = [signature(primitive)];
		help.activeSignature = 0;
		help.activeParameter = Math.min(call.argument, primitive.args.length - 1);
		return help;
	}
}

function signature(primitive: Primitive): vscode.SignatureInformation {
	const maxArity = primitive.arity[primitive.arity.length - 1];
	const args = primitive.args.slice(0, maxArity);
	const info = new vscode.SignatureInformation(
		`${primitive.name}(${args.join(", ")})`,
		new vscode.MarkdownString(`${primitive.help}\n\n*${primitiveNotes(primitive)}*`)
	);
	info.parameters = args.map((name) => new vscode.ParameterInformation(name));
	return info;
}

interface EnclosingCall {
	name: string;
	/** Zero-based index of the argument the cursor sits in. */
	argument: number;
}

/**
 * Finds the primitive whose argument list the cursor is inside.
 *
 * Walks left from the cursor counting parentheses, so a nested call such as
 * `AEAD_DEC(k, AEAD_ENC(k, m, ad), ad)` reports the inner primitive while the
 * cursor is inside it. A capability annotation between the name and its
 * arguments is stepped over, since `ENC[malleable](k, m)` is still a call to
 * `ENC`.
 */
function enclosingCall(prefix: string): EnclosingCall | undefined {
	let depth = 0;
	let argument = 0;
	for (let i = prefix.length - 1; i >= 0; i--) {
		const c = prefix[i];
		if (c === ")") {
			depth++;
		} else if (c === "(") {
			if (depth === 0) {
				const name = identifierBefore(prefix, i);
				return name ? { name, argument } : undefined;
			}
			depth--;
		} else if (c === "," && depth === 0) {
			argument++;
		}
	}
	return undefined;
}

function identifierBefore(text: string, parenIndex: number): string | undefined {
	let i = parenIndex - 1;
	while (i >= 0 && /\s/.test(text[i])) {
		i--;
	}
	if (i >= 0 && text[i] === "]") {
		let depth = 0;
		while (i >= 0) {
			if (text[i] === "]") {
				depth++;
			} else if (text[i] === "[") {
				depth--;
				if (depth === 0) {
					i--;
					break;
				}
			}
			i--;
		}
		while (i >= 0 && /\s/.test(text[i])) {
			i--;
		}
	}
	const end = i + 1;
	while (i >= 0 && /[A-Za-z0-9_]/.test(text[i])) {
		i--;
	}
	const name = text.slice(i + 1, end);
	return name.length > 0 ? name : undefined;
}

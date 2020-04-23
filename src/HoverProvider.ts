/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import * as vscode from 'vscode';
import VerifpalLib from './VerifpalLib';
import { rejects } from 'assert';
export default class HoverProvider {
	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken): Promise<any> {
		const wordPosition = document.getWordRangeAtPosition(position);
		if (!wordPosition) return new Promise((resolve) => resolve());
		const word = document.getText(wordPosition);
		const fileContents = document.getText();
		return VerifpalLib.getKnowledgeMap(fileContents).then((result: string) => {
			const knowledgeMap = JSON.parse(result.toString())
			if (primitiveInfo.hasOwnProperty(word.toUpperCase())) {
				const p = primitiveInfo[word];
				let hoverText = `${p.eg}\n// ${p.help}`;
				return new Promise((resolve, reject) => {
					resolve(new vscode.Hover([
						'Verifpal', {
							language: 'verifpal',
							value: hoverText
						}
					]))
				})
			} else {
				let info = constantInfo(word, knowledgeMap);
				if (!info.Valid) {
					return
				}
				return VerifpalLib.getPrettyValue(info.Assigned).then((result: string) => {
					let hoverText = `// Created by ${info.Creator}\n${result}`;
					return new Promise((resolve, reject) => {
						resolve(new vscode.Hover([
							'Verifpal', {
								language: 'verifpal',
								value: hoverText
							}
						]))
					})
				})
			}
		});	
	}
}

export const constantInfo = (constant: string, knowledgeMap) => {
	let info = {
		Creator: "",
		Assigned: "",
		KnownBy: "",
		Valid: false,
	}
	let i = VerifpalLib.getKnowledgeMapIndexFromConstant(constant, knowledgeMap)
	if (i >= 0) {
		info.Creator = knowledgeMap.Creator[i];
		info.Assigned = JSON.stringify(knowledgeMap.Assigned[i]) + "\n";
		info.KnownBy = JSON.stringify(knowledgeMap.KnownBy[i]) + "\n";
		info.Valid = true;
	}
	return info;
}

export const primitiveInfo = {
	"ASSERT": {
		arity: 2,
		output: 1,
		eg: "ASSERT(MAC(key, message), MAC(key, message)): unused",
		help: "Checks the equality of two values, and especially useful for checking MAC equality. Output value is not used."
	},
	"CONCAT": {
		arity: -1,
		output: 1,
		eg: "CONCAT(a, b): c",
		help: "Concatenates two or more values2 into one value. For example, the concatenation of the strings `cat` and `dog` would be `catdog`."
	},
	"SPLIT": {
		arity: 1,
		output: -1,
		eg: "SPLIT(CONCAT(a, b)): a, b",
		help: "Splits a concatenation back to its component values. Must contain a CONCAT primitive as input; otherwise, Verifpal will output an error."
	},
	"HASH": {
		arity: -1,
		output: 1,
		eg: "HASH(a, b...): x",
		help: "Secure hash function, similar in practice to, for example, BLAKE2s. Takes an arbitrary number of input arguments ≥ 1, and returns one output."
	},
	"MAC": {
		arity: 2,
		output: 1,
		eg: "MAC(key, message): h",
		help: "Keyed hash function. Useful for message authentication and for some other protocol constructions."
	},
	"HKDF": {
		arity: 3,
		output: -1,
		eg: "HKDF(salt, ikm, info): a, b...",
		help: "Hash-based key derivation function inspired by the Krawczyk HKDF scheme. Essentially, HKDF is used to extract more than one key out a single secret value. salt and info help contextualize derived keys. Produces an arbitrary number of outputs ≥ 1."
	},
	"PW_HASH": {
		arity: 1,
		output: 1,
		eg: "PW_HASH(a): x",
		help: "Password hashing function, similar in practice to, for example, Scrypt or Argon2. Hashes passwords and produces output that is suitable for use as a private key, secret key or other sensitive key material. Useful in conjunction with values declared using `knows password a`."
	},
	"ENC": {
		arity: 2,
		output: 1,
		eg: "ENC(key, plaintext): ciphertext",
		help: "Symmetric encryption, similar for example to AES-CBC or to ChaCha20."
	},
	"DEC": {
		arity: 2,
		output: 1,
		eg: "DEC(key, ENC(key, plaintext)): plaintext",
		help: "Symmetric decryption."
	},
	"AEAD_ENC": {
		arity: 3,
		output: 1,
		eg: "AEAD_ENC(key, plaintext, ad): ciphertext",
		help: "Authenticated encryption with associated data. `ad` represents an additional payload that is not encrypted, but that must be provided exactly in the decryption function for authenticated decryption to succeed. Similar for example to AES-GCM or to ChaCha20-Poly1305."
	},
	"AEAD_DEC": {
		arity: 3,
		output: 1,
		eg: "AEAD_DEC(key, AEAD_ENC(key, plaintext, ad), ad): plaintext",
		help: "Authenticated decryption with associated data."
	},
	"PKE_ENC": {
		arity: 2,
		output: 1,
		eg: "PKE_ENC(G^key, plaintext): ciphertext",
		help: "Public-key encryption."
	},
	"PKE_DEC": {
		arity: 2,
		output: 1,
		eg: "PKE_DEC(key, PKE_ENC(G^key, plaintext)): plaintext",
		help: "Public-key decryption."
	},
	"SIGN": {
		arity: 2,
		output: 1,
		eg: "SIGN(key, message): signature",
		help: "Classic signature primitive. Here, `key` is a private key, for example `a`."
	},
	"SIGNVERIF": {
		arity: 3,
		output: 1,
		eg: "SIGNVERIF(G^key, message, SIGN(key, message)): message",
		help: "Verifies if signature can be authenticated. If key a was used for SIGN, then SIGNVERIF will expect `G^a` as the key value."
	},
	"RINGSIGN": {
		arity: 4,
		output: 1,
		eg: "RINGSIGN(key_a, G^key_b, G^key_c, message): signature",
		help: "Ring signature. In ring signatures, one of three parties (Alice, Bob and Charlie) signs a message. The resulting signature can be verified using the public key of any of the three parties, and the signature does not reveal the signatory, only that they are a member of the signing ring (Alice, Bob or Charlie). The first key must be the private key of the actual signer, while the subsequent two keys must be the public keys of the other potential signers."
	},
	"RINGSIGNVERIF": {
		arity: 5,
		output: 1,
		eg: "RINGSIGNVERIF(G^a, G^b, G^c, m, RINGSIGN(a, G^b, G^c, m)): m",
		help: "Verifies if a ring signature can be authenticated. The signer’s public key must match one or more of the public keys provided, but the public keys may be provided in any order and not necessarily in the order used during the RINGSIGN operation."
	},
	"SHAMIR_SPLIT": {
		arity: 1,
		output: 3,
		eg: "SHAMIR_SPLIT(k): s1, s2, s3",
		help: "In Verifpal, we allow splitting the key into three shares such that only two shares are required to reconstitute it."
	},
	"SHAMIR_JOIN": {
		arity: 2,
		output: 1,
		eg: "SHAMIR_JOIN(sa, sb): k",
		help: "Here, sa and sb must be two distinct elements out of the set (s1, s2, s3) in order to obtain k."
	}
};
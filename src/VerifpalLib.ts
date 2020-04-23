/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

/// <reference path="./cross-spawn.d.ts" />
import {
	spawn
} from 'cross-spawn';
import * as vscode from 'vscode';
import {
	configDeterminePath
} from './config';

/*
type KnowledgeMap struct {
	Principals []string
	Constants  []Constant
	Assigned   []Value
	Creator    []string
	KnownBy    [][]map[string]string
	Phase      [][]int
	MaxPhase   int
}

type PrincipalState struct {
	Name          string
	Constants     []Constant
	Assigned      []Value
	Guard         []bool
	Known         []bool
	Wire          [][]string
	KnownBy       [][]map[string]string
	Creator       []string
	Sender        []string
	Rewritten     []bool
	BeforeRewrite []Value
	Mutated       []bool
	MutatableTo   [][]string
	BeforeMutate  []Value
	Phase         [][]int
	Lock          int
}
*/

export default class VerifpalLib {

	static execVerifpal(fileContents, args) {
		return new Promise((resolve, reject) => {
			let verifpalOutput = "";
			let verifpalOutputError = "";
			const verifpalProc = spawn(configDeterminePath(), args);
			verifpalProc.stdout.on('data', (data) => {
				verifpalOutput += data.toString();
			});
			verifpalProc.stderr.on('data', (data) => {
				verifpalOutputError += data.toString();
			});
			verifpalProc.on('exit', () => {
				if (verifpalOutputError) {
					reject(verifpalOutputError);
				} else {
					let result = verifpalOutput;
					resolve(result);
				}
			});
			verifpalProc.stdin.write(
				`${fileContents}${String.fromCharCode(0x04)}`
			);
			verifpalProc.stdin.end();
		});
	}

	static getKnowledgeMap(fileContents: string) {
		return VerifpalLib.execVerifpal(fileContents, ['internal-json', 'knowledgeMap']);
	}

	static getPrettyValue(fileContents: string) {
		return VerifpalLib.execVerifpal(fileContents, ['internal-json', 'prettyValue']);
	}

	static getPrettyQuery(fileContents: string) {
		return VerifpalLib.execVerifpal(fileContents, ['internal-json', 'prettyQuery']);
	}

	static getPrettyPrint(fileContents: string) {
		return VerifpalLib.execVerifpal(fileContents, ['internal-json', 'prettyPrint']);
	}

	static getVerify(fileContents: string) {
		return VerifpalLib.execVerifpal(fileContents, ['internal-json', 'verify']);
	}

	static getKnowledgeMapIndexFromConstant(constant: string, knowledgeMap) {
		for (let i = 0; i < knowledgeMap.Constants.length; i++) {
			if (knowledgeMap.Constants[i].Name === constant) {
				return i
			}
		}
		return -1
	}

	static constantInfo = (constantName: string, knowledgeMap) => {
		let info = {
			Creator: "",
			Assigned: "",
			KnownBy: "",
			Valid: false,
		}
		let i = VerifpalLib.getKnowledgeMapIndexFromConstant(constantName, knowledgeMap)
		if (i >= 0) {
			info.Creator = knowledgeMap.Creator[i];
			info.Assigned = JSON.stringify(knowledgeMap.Assigned[i]) + "\n";
			info.KnownBy = JSON.stringify(knowledgeMap.KnownBy[i]) + "\n";
			info.Valid = true;
		}
		return info;
	}

	static primitiveInfo = (primitiveName: string) => {
		let primitives = {
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
		}
		if (primitives.hasOwnProperty(primitiveName.toUpperCase())) {
			let p = primitives[primitiveName.toUpperCase()];
			return `${p.eg}\n// ${p.help}`;
		}
		return '';
	};

	static queryInfo = (queryName: string) => {
		let queries = {
			"confidentiality": {
				eg: "confidentiality? a",
				help: "Checks whether a given value can be obtained by the attacker.",
			},
			"authentication": {
				eg: "authentication? Alice -> Bob: m",
				help: "Checks whether Bob will rely on some value m in an important protocol operation (such as signature verification or authenticated decryption) if and only if he received that value from Alice. If Bob is successful in using m for signature verification or a similar operation without it having been necessarily sent by Alice, then authentication is violated for e1, and the attacker was able to impersonate Alice in communicating that value.",
			},
			"freshnness": {
				eg: "freshness? a",
				help: "Freshness queries are useful for detecting replay attacks, where an attacker could manipulate one message to make it seem valid in two different contexts. In passive attacker mode, a freshness query will check whether a value is “fresh” between sessions (i.e. if it has at least one composing element that is generated, non-static). In active attacker mode, it will check whether a value can be rendered “non-fresh” (i.e. static between sessions) and subsequently successfully used between sessions.",
			},
			"unlinkability": {
				eg: "unlinkability? a, b, c",
				help: "Checks whether all given values satisfy freshness. If they do, checks whether the attacker can determine them as being the output of the same primitive or as otherwise having a common source. If any of these checks fail, the query fails.",
			}
		}
		if (queries.hasOwnProperty(queryName.toLowerCase())) {
			let q = queries[queryName.toLowerCase()];
			return `${q.eg}\n// ${q.help}`;
		}
		return '';
	}
}
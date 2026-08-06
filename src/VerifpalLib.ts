/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

import { spawn } from "cross-spawn";
import { configDeterminePath } from "./config";

export interface KnowledgeMapConstant {
	Name: string;
}

export interface KnowledgeMap {
	Constants: KnowledgeMapConstant[];
	Creator: string[];
	Assigned: string[];
	KnownBy: Record<string, string>[][];
	Principals: string[];
	Phase: number[][];
	MaxPhase: number;
}

export interface VerifyResult {
	Query: string;
	Resolved: boolean;
	Summary: string;
	Constants: string[];
}

export interface ConstantInfo {
	Creator: string;
	Assigned: string;
	KnownBy: string;
	Valid: boolean;
}

export default class VerifpalLib {

	static execVerifpal(fileContents: string, args: string[]): Promise<string> {
		return new Promise((resolve, reject) => {
			let verifpalOutput = "";
			let verifpalOutputError = "";
			const verifpalProc = spawn(configDeterminePath(), args);
			verifpalProc.on("error", (err: Error) => {
				reject(err.message);
			});
			verifpalProc.stdout?.on("data", (data: Buffer) => {
				verifpalOutput += data.toString();
			});
			verifpalProc.stderr?.on("data", (data: Buffer) => {
				verifpalOutputError += data.toString();
			});
			verifpalProc.on("exit", () => {
				if (verifpalOutputError) {
					reject(verifpalOutputError);
				} else {
					resolve(verifpalOutput);
				}
			});
			verifpalProc.stdin?.write(
				`${fileContents}${String.fromCharCode(0x04)}`
			);
			verifpalProc.stdin?.end();
		});
	}

	static getKnowledgeMap(fileContents: string): Promise<string> {
		return VerifpalLib.execVerifpal(fileContents, ["internal-json", "knowledgeMap"]);
	}

	static getPrettyPrint(fileContents: string): Promise<string> {
		return VerifpalLib.execVerifpal(fileContents, ["internal-json", "prettyPrint"]);
	}

	static getPrettyDiagram(fileContents: string): Promise<string> {
		return VerifpalLib.execVerifpal(fileContents, ["internal-json", "prettyDiagram"]);
	}

	static getVerify(fileContents: string): Promise<string> {
		return VerifpalLib.execVerifpal(fileContents, ["internal-json", "verify"]);
	}

	static getKnowledgeMapIndexFromConstant(constant: string, knowledgeMap: KnowledgeMap): number {
		for (let i = 0; i < knowledgeMap.Constants.length; i++) {
			if (knowledgeMap.Constants[i].Name === constant) {
				return i;
			}
		}
		return -1;
	}

	static constantInfo(constantName: string, knowledgeMap: KnowledgeMap): ConstantInfo {
		const info: ConstantInfo = {
			Creator: "",
			Assigned: "",
			KnownBy: "",
			Valid: false,
		};
		const i = VerifpalLib.getKnowledgeMapIndexFromConstant(constantName, knowledgeMap);
		if (i >= 0) {
			info.Creator = knowledgeMap.Creator[i];
			info.Assigned = knowledgeMap.Assigned[i];
			info.KnownBy = JSON.stringify(knowledgeMap.KnownBy[i]) + "\n";
			info.Valid = true;
		}
		return info;
	}

	static primitiveInfo(primitiveName: string): string {
		const primitives: Record<string, { output: number; eg: string; help: string }> = {
			"ASSERT": {
				output: 1,
				eg: "ASSERT(MAC(key, message), MAC(key, message)): unused",
				help: "Checks the equality of two values, and especially useful for checking MAC equality. Output value is not used. May be suffixed with `?` to halt the principal if the check fails."
			},
			"CONCAT": {
				output: 1,
				eg: "CONCAT(a, b...): c",
				help: "Concatenates between two and five values into one value. For example, the concatenation of the strings `cat` and `dog` would be `catdog`."
			},
			"SPLIT": {
				output: -1,
				eg: "SPLIT(CONCAT(a, b)): a, b",
				help: "Splits a concatenation back to its component values, producing between one and five outputs. Must contain a CONCAT primitive as input; otherwise, Verifpal will output an error. May be suffixed with `?` to halt the principal if the check fails."
			},
			"HASH": {
				output: 1,
				eg: "HASH(a, b...): x",
				help: "Secure hash function, similar in practice to, for example, BLAKE2s. Takes between one and five input arguments, and returns one output."
			},
			"MAC": {
				output: 1,
				eg: "MAC(key, message): h",
				help: "Keyed hash function. Useful for message authentication and for some other protocol constructions."
			},
			"HKDF": {
				output: -1,
				eg: "HKDF(salt, ikm, info): a, b...",
				help: "Hash-based key derivation function inspired by the Krawczyk HKDF scheme. Essentially, HKDF is used to extract more than one key out a single secret value. salt and info help contextualize derived keys. Takes exactly three arguments and produces between one and five outputs."
			},
			"PW_HASH": {
				output: 1,
				eg: "PW_HASH(a...): x",
				help: "Password hashing function, similar in practice to, for example, Scrypt or Argon2. Hashes passwords and produces output that is suitable for use as a private key, secret key or other sensitive key material. Takes between one and five arguments. Useful in conjunction with values declared using `knows password a`."
			},
			"ENC": {
				output: 1,
				eg: "ENC(key, plaintext): ciphertext",
				help: "Symmetric encryption, similar for example to AES-CBC or to ChaCha20."
			},
			"DEC": {
				output: 1,
				eg: "DEC(key, ENC(key, plaintext)): plaintext",
				help: "Symmetric decryption."
			},
			"AEAD_ENC": {
				output: 1,
				eg: "AEAD_ENC(key, plaintext, ad): ciphertext",
				help: "Authenticated encryption with associated data. `ad` represents an additional payload that is not encrypted, but that must be provided exactly in the decryption function for authenticated decryption to succeed. Similar for example to AES-GCM or to ChaCha20-Poly1305."
			},
			"AEAD_DEC": {
				output: 1,
				eg: "AEAD_DEC(key, AEAD_ENC(key, plaintext, ad), ad): plaintext",
				help: "Authenticated decryption with associated data. May be suffixed with `?` to halt the principal if decryption fails."
			},
			"PUBKEY": {
				output: 1,
				eg: "PUBKEY(private_key): public_key",
				help: "Derives the public key corresponding to a private key. The same constructor is used for Diffie-Hellman, signatures, public-key encryption and ring signatures. Its argument may not itself be a public key or a shared secret."
			},
			"DH_KEX": {
				output: 1,
				eg: "DH_KEX(PUBKEY(a), b): shared_secret",
				help: "Diffie-Hellman key exchange. DH_KEX(PUBKEY(a), b) and DH_KEX(PUBKEY(b), a) yield the same shared secret. The first argument is the peer's public key and the second is your own private value: the second argument may not be a public key, and neither argument may itself be a DH_KEX, since the attacker cannot compute a shared secret from two public keys."
			},
			"KEM_ENCAP": {
				output: 2,
				eg: "ss, ct = KEM_ENCAP(PUBKEY(dk), r)",
				help: "Key encapsulation, as in a post-quantum KEM such as ML-KEM. Takes the recipient's encapsulation key `PUBKEY(dk)` and a random value, and binds two outputs: the shared secret and the encapsulation ciphertext that transports it. The random value should be freshly generated, since encapsulating twice under the same randomness yields the same shared secret. The random value may not be a public key, and the encapsulation key may not itself be a shared secret. A KEM says nothing about who performed the encapsulation: authenticate the ciphertext separately if the recipient needs to know who it came from."
			},
			"KEM_DECAP": {
				output: 1,
				eg: "KEM_DECAP(dk, ct): ss",
				help: "Key decapsulation. Recovers the shared secret from an encapsulation ciphertext using the private decapsulation key `dk` matching the `PUBKEY(dk)` used to encapsulate. May be suffixed with `?` to halt the principal if decapsulation fails."
			},
			"PKE_ENC": {
				output: 1,
				eg: "PKE_ENC(PUBKEY(key), plaintext): ciphertext",
				help: "Public-key encryption."
			},
			"PKE_DEC": {
				output: 1,
				eg: "PKE_DEC(key, PKE_ENC(PUBKEY(key), plaintext)): plaintext",
				help: "Public-key decryption."
			},
			"SIGN": {
				output: 1,
				eg: "SIGN(key, message): signature",
				help: "Classic signature primitive. Here, `key` is a private key, for example `a`."
			},
			"SIGNVERIF": {
				output: 1,
				eg: "SIGNVERIF(PUBKEY(key), message, SIGN(key, message)): message",
				help: "Verifies if signature can be authenticated. If key a was used for SIGN, then SIGNVERIF will expect `PUBKEY(a)` as the key value. May be suffixed with `?` to halt the principal if verification fails."
			},
			"RINGSIGN": {
				output: 1,
				eg: "RINGSIGN(key_a, PUBKEY(key_b), PUBKEY(key_c), message): signature",
				help: "Ring signature. In ring signatures, one of three parties (Alice, Bob and Charlie) signs a message. The resulting signature can be verified using the public key of any of the three parties, and the signature does not reveal the signatory, only that they are a member of the signing ring (Alice, Bob or Charlie). The first key must be the private key of the actual signer, while the subsequent two keys must be the public keys of the other potential signers."
			},
			"RINGSIGNVERIF": {
				output: 1,
				eg: "RINGSIGNVERIF(PUBKEY(a), PUBKEY(b), PUBKEY(c), m, RINGSIGN(a, PUBKEY(b), PUBKEY(c), m)): m",
				help: "Verifies if a ring signature can be authenticated. The signer's public key must match one or more of the public keys provided, but the public keys may be provided in any order and not necessarily in the order used during the RINGSIGN operation. May be suffixed with `?` to halt the principal if verification fails."
			},
			"BLIND": {
				output: 1,
				eg: "BLIND(k, m): b",
				help: "Message blinding primitive, useful for the implementation of blind signatures. Here, the sender uses the secret \"blinding factor\" `k` in order to blind message `m`, which can then be sent to the signer, who will be able to produce a signature on `m` without knowing `m`. Used in conjunction with UNBLIND -- see UNBLIND's documentation for more information."
			},
			"UNBLIND": {
				output: 1,
				eg: "UNBLIND(k, m, SIGN(a, BLIND(k, m))): SIGN(a, m)",
				help: "Once `BLIND(k, m)` is signed by the signer, the sender can convert `SIGN(a, BLIND(k, m))` to `SIGN(a, m)` by unblinding the message using their secret blinding factor `k`. The resulting unblinded signature can then be used as if it were a regular signature by `a` over `m`."
			},
			"SHAMIR_SPLIT": {
				output: 3,
				eg: "SHAMIR_SPLIT(k): s1, s2, s3",
				help: "In Verifpal, we allow splitting the key into three shares such that only two shares are required to reconstitute it."
			},
			"SHAMIR_JOIN": {
				output: 1,
				eg: "SHAMIR_JOIN(sa, sb): k",
				help: "Here, sa and sb must be two distinct elements out of the set (s1, s2, s3) in order to obtain k."
			}
		};
		if (Object.prototype.hasOwnProperty.call(primitives, primitiveName.toUpperCase())) {
			const p = primitives[primitiveName.toUpperCase()];
			return `${p.eg}\n// ${p.help}`;
		}
		return "";
	}

	static queryInfo(queryName: string): string {
		const queries: Record<string, { eg: string; help: string }> = {
			"confidentiality": {
				eg: "confidentiality? a",
				help: "Checks whether a given value can be obtained by the attacker.",
			},
			"authentication": {
				eg: "authentication? Alice -> Bob: m",
				help: "Checks whether Bob will rely on some value m in an important protocol operation (such as signature verification or authenticated decryption) if and only if he received that value from Alice. If Bob is successful in using m for signature verification or a similar operation without it having been necessarily sent by Alice, then authentication is violated for m, and the attacker was able to impersonate Alice in communicating that value.",
			},
			"freshness": {
				eg: "freshness? a",
				help: "Freshness queries are useful for detecting replay attacks, where an attacker could manipulate one message to make it seem valid in two different contexts. In passive attacker mode, a freshness query will check whether a value is \u201cfresh\u201d between sessions (i.e. if it has at least one composing element that is generated, non-static). In active attacker mode, it will check whether a value can be rendered \u201cnon-fresh\u201d (i.e. static between sessions) and subsequently successfully used between sessions.",
			},
			"unlinkability": {
				eg: "unlinkability? a, b, c",
				help: "Checks whether all given values satisfy freshness. If they do, checks whether the attacker can determine them as being the output of the same primitive or as otherwise having a common source. If any of these checks fail, the query fails.",
			},
			"equivalence": {
				eg: "equivalence? ss_a, ss_b",
				help: "Checks whether any protocol scenario can be derived such that the given values are not equivalent to one another. This query could be useful for checking if all parties derived the same shared secret, for example."
			},
			"precondition": {
				eg: "confidentiality? m[ precondition[ Bob -> Alice: ack ] ]",
				help: "An option that may be attached to any query. When the query fails, the result is additionally annotated to note that the message described in the precondition is sent despite the query failing. The sender must know the constant, the recipient must receive it, and the recipient must actually use it inside a primitive, or the model is rejected."
			}
		};
		if (Object.prototype.hasOwnProperty.call(queries, queryName.toLowerCase())) {
			const q = queries[queryName.toLowerCase()];
			return `${q.eg}\n// ${q.help}`;
		}
		return "";
	}
}

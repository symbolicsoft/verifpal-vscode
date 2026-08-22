/* SPDX-FileCopyrightText: © 2019-2026 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

/**
 * The Verifpal language, as the engine defines it.
 *
 * Every table here mirrors a table in the Verifpal source: the primitives and
 * their arities come from `src/primitive/spec.rs`, the capabilities from
 * `src/capability.rs`, and the query kinds from `src/types.rs`. Keeping the
 * arity, output count, checkability and accepted capabilities as data rather
 * than as prose in a help string is what lets the hover, the completions and
 * the signature help all say the same thing, and lets a test assert that this
 * file still describes the engine that ships.
 *
 * This module deliberately imports nothing: it is the one piece of the
 * extension that is pure data, and it is unit-tested directly.
 */

/** A declared weakening assumption, spelled inside a primitive's brackets. */
export type Capability = "weak" | "forgeable" | "malleable";

export interface Primitive {
	name: string;
	/** Argument names, in order, as the engine's `arg_names` gives them. */
	args: string[];
	/** Every argument count the primitive accepts. */
	arity: number[];
	/** Every output count the primitive can bind. */
	outputs: number[];
	/** Whether the primitive may take the `?` suffix (engine: `definition_check`). */
	checkable: boolean;
	/** Weakening assumptions this primitive accepts on a call site. */
	capabilities: Capability[];
	/** A one-line example, shown first in the hover. */
	eg: string;
	help: string;
}

function arity(p: Primitive): string {
	const a = p.arity;
	const args = a.length === 1
		? `${a[0]} argument${a[0] === 1 ? "" : "s"}`
		: `${a[0]}–${a[a.length - 1]} arguments`;
	const o = p.outputs;
	const outs = o.length === 1
		? `${o[0]} output${o[0] === 1 ? "" : "s"}`
		: `${o[0]}–${o[o.length - 1]} outputs`;
	return `${args}, ${outs}`;
}

/**
 * The trailing line of a primitive hover: the facts a modeller needs at the
 * call site and would otherwise have to look up in the manual.
 */
export function primitiveNotes(p: Primitive): string {
	const notes = [arity(p)];
	if (p.checkable) {
		notes.push("may be checked with `?`");
	}
	if (p.capabilities.length > 0) {
		notes.push(`accepts [${p.capabilities.join(", ")}]`);
	}
	return notes.join("; ");
}

/** A `NAME(arg, arg)` skeleton, used for completion snippets and signature help. */
export function primitiveSignature(p: Primitive): string {
	return `${p.name}(${p.args.slice(0, p.arity[0]).join(", ")})`;
}

export const PRIMITIVES: Primitive[] = [
	{
		name: "ASSERT",
		args: ["value1", "value2"],
		arity: [2], outputs: [1], checkable: true, capabilities: [],
		eg: "ASSERT(MAC(key, message), MAC(key, message)): unused",
		help: "Checks the equality of two values, and especially useful for checking MAC equality. Output value is not used. May be suffixed with `?` to halt the principal if the check fails."
	},
	{
		name: "CONCAT",
		args: ["value1", "value2", "value3", "value4", "value5"],
		arity: [2, 3, 4, 5], outputs: [1], checkable: false, capabilities: [],
		eg: "CONCAT(a, b...): c",
		help: "Concatenates between two and five values into one value. For example, the concatenation of the strings `cat` and `dog` would be `catdog`."
	},
	{
		name: "SPLIT",
		args: ["concatenation"],
		arity: [1], outputs: [1, 2, 3, 4, 5], checkable: true, capabilities: [],
		eg: "SPLIT(CONCAT(a, b)): a, b",
		help: "Splits a concatenation back to its component values, producing between one and five outputs. Must contain a CONCAT primitive as input; otherwise, Verifpal will output an error. May be suffixed with `?` to halt the principal if the check fails."
	},
	{
		name: "HASH",
		args: ["value1", "value2", "value3", "value4", "value5"],
		arity: [1, 2, 3, 4, 5], outputs: [1], checkable: false, capabilities: ["weak"],
		eg: "HASH(a, b...): x",
		help: "Secure hash function, similar in practice to, for example, BLAKE2s. Takes between one and five input arguments, and returns one output."
	},
	{
		name: "MAC",
		args: ["key", "message"],
		arity: [2], outputs: [1], checkable: false, capabilities: ["forgeable"],
		eg: "MAC(key, message): h",
		help: "Keyed hash function. Useful for message authentication and for some other protocol constructions."
	},
	{
		name: "HKDF",
		args: ["salt", "ikm", "info"],
		arity: [3], outputs: [1, 2, 3, 4, 5], checkable: false, capabilities: [],
		eg: "HKDF(salt, ikm, info): a, b...",
		help: "Hash-based key derivation function inspired by the Krawczyk HKDF scheme. Essentially, HKDF is used to extract more than one key out a single secret value. salt and info help contextualize derived keys. Takes exactly three arguments and produces between one and five outputs."
	},
	{
		name: "PW_HASH",
		args: ["value1", "value2", "value3", "value4", "value5"],
		arity: [1, 2, 3, 4, 5], outputs: [1], checkable: false, capabilities: ["weak"],
		eg: "PW_HASH(a...): x",
		help: "Password hashing function, similar in practice to, for example, Scrypt or Argon2. Hashes passwords and produces output that is suitable for use as a private key, secret key or other sensitive key material. Takes between one and five arguments. Useful in conjunction with values declared using `knows password a`."
	},
	{
		name: "ENC",
		args: ["key", "plaintext"],
		arity: [2], outputs: [1], checkable: false, capabilities: ["weak", "malleable"],
		eg: "ENC(key, plaintext): ciphertext",
		help: "Symmetric encryption, similar for example to AES-CBC or to ChaCha20. Unauthenticated, which is why it is the one primitive that accepts `malleable`."
	},
	{
		name: "DEC",
		args: ["key", "ciphertext"],
		arity: [2], outputs: [1], checkable: false, capabilities: [],
		eg: "DEC(key, ENC(key, plaintext)): plaintext",
		help: "Symmetric decryption."
	},
	{
		name: "AEAD_ENC",
		args: ["key", "plaintext", "ad"],
		arity: [3], outputs: [1], checkable: false, capabilities: ["weak", "forgeable"],
		eg: "AEAD_ENC(key, plaintext, ad): ciphertext",
		help: "Authenticated encryption with associated data. `ad` represents an additional payload that is not encrypted, but that must be provided exactly in the decryption function for authenticated decryption to succeed. Similar for example to AES-GCM or to ChaCha20-Poly1305."
	},
	{
		name: "AEAD_DEC",
		args: ["key", "ciphertext", "ad"],
		arity: [3], outputs: [1], checkable: true, capabilities: [],
		eg: "AEAD_DEC(key, AEAD_ENC(key, plaintext, ad), ad): plaintext",
		help: "Authenticated decryption with associated data. May be suffixed with `?` to halt the principal if decryption fails."
	},
	{
		name: "PUBKEY",
		args: ["private_key"],
		arity: [1], outputs: [1], checkable: false, capabilities: ["weak"],
		eg: "PUBKEY(private_key): public_key",
		help: "Derives the public key corresponding to a private key. The same constructor is used for Diffie-Hellman, signatures, public-key encryption and ring signatures. Its argument may not itself be a public key or a shared secret."
	},
	{
		name: "DH_KEX",
		args: ["public_key", "private_key"],
		arity: [2], outputs: [1], checkable: false, capabilities: [],
		eg: "DH_KEX(PUBKEY(a), b): shared_secret",
		help: "Diffie-Hellman key exchange. DH_KEX(PUBKEY(a), b) and DH_KEX(PUBKEY(b), a) yield the same shared secret. The first argument is the peer's public key and the second is your own private value: the second argument may not be a public key, and neither argument may itself be a DH_KEX, since the attacker cannot compute a shared secret from two public keys."
	},
	{
		name: "KEM_ENCAP",
		args: ["public_key", "seed"],
		arity: [2], outputs: [2], checkable: false, capabilities: ["weak"],
		eg: "ss, ct = KEM_ENCAP(PUBKEY(dk), r)",
		help: "Key encapsulation, as in a post-quantum KEM such as ML-KEM. Takes the recipient's encapsulation key `PUBKEY(dk)` and a random value, and binds two outputs: the shared secret and the encapsulation ciphertext that transports it. The random value should be freshly generated, since encapsulating twice under the same randomness yields the same shared secret. The random value may not be a public key, and the encapsulation key may not itself be a shared secret. A KEM says nothing about who performed the encapsulation: authenticate the ciphertext separately if the recipient needs to know who it came from."
	},
	{
		name: "KEM_DECAP",
		args: ["private_key", "ciphertext"],
		arity: [2], outputs: [1], checkable: true, capabilities: [],
		eg: "KEM_DECAP(dk, ct): ss",
		help: "Key decapsulation. Recovers the shared secret from an encapsulation ciphertext using the private decapsulation key `dk` matching the `PUBKEY(dk)` used to encapsulate. May be suffixed with `?` to halt the principal if decapsulation fails."
	},
	{
		name: "PKE_ENC",
		args: ["public_key", "plaintext"],
		arity: [2], outputs: [1], checkable: false, capabilities: ["weak"],
		eg: "PKE_ENC(PUBKEY(key), plaintext): ciphertext",
		help: "Public-key encryption."
	},
	{
		name: "PKE_DEC",
		args: ["private_key", "ciphertext"],
		arity: [2], outputs: [1], checkable: false, capabilities: [],
		eg: "PKE_DEC(key, PKE_ENC(PUBKEY(key), plaintext)): plaintext",
		help: "Public-key decryption."
	},
	{
		name: "SIGN",
		args: ["private_key", "message"],
		arity: [2], outputs: [1], checkable: false, capabilities: ["forgeable"],
		eg: "SIGN(key, message): signature",
		help: "Classic signature primitive. Here, `key` is a private key, for example `a`."
	},
	{
		name: "SIGNVERIF",
		args: ["public_key", "message", "signature"],
		arity: [3], outputs: [1], checkable: true, capabilities: [],
		eg: "SIGNVERIF(PUBKEY(key), message, SIGN(key, message)): verified",
		help: "Verifies if signature can be authenticated. If key a was used for SIGN, then SIGNVERIF will expect `PUBKEY(a)` as the key value. May be suffixed with `?` to halt the principal if verification fails."
	},
	{
		name: "RINGSIGN",
		args: ["signer_key", "public_key_b", "public_key_c", "message"],
		arity: [4], outputs: [1], checkable: false, capabilities: ["forgeable"],
		eg: "RINGSIGN(key_a, PUBKEY(key_b), PUBKEY(key_c), message): signature",
		help: "Ring signature. In ring signatures, one of three parties (Alice, Bob and Charlie) signs a message. The resulting signature can be verified using the public key of any of the three parties, and the signature does not reveal the signatory, only that they are a member of the signing ring (Alice, Bob or Charlie). The first key must be the private key of the actual signer, while the subsequent two keys must be the public keys of the other potential signers."
	},
	{
		name: "RINGSIGNVERIF",
		args: ["public_key_a", "public_key_b", "public_key_c", "message", "signature"],
		arity: [5], outputs: [1], checkable: true, capabilities: [],
		eg: "RINGSIGNVERIF(PUBKEY(a), PUBKEY(b), PUBKEY(c), m, RINGSIGN(a, PUBKEY(b), PUBKEY(c), m)): verified",
		help: "Verifies if a ring signature can be authenticated. The signer's public key must match one or more of the public keys provided, but the public keys may be provided in any order and not necessarily in the order used during the RINGSIGN operation. May be suffixed with `?` to halt the principal if verification fails."
	},
	{
		name: "BLIND",
		args: ["blinding_factor", "message"],
		arity: [2], outputs: [1], checkable: false, capabilities: [],
		eg: "BLIND(k, m): b",
		help: "Message blinding primitive, useful for the implementation of blind signatures. Here, the sender uses the secret \"blinding factor\" `k` in order to blind message `m`, which can then be sent to the signer, who will be able to produce a signature on `m` without knowing `m`. Used in conjunction with UNBLIND -- see UNBLIND's documentation for more information."
	},
	{
		name: "UNBLIND",
		args: ["blinding_factor", "message", "blinded_signature"],
		arity: [3], outputs: [1], checkable: false, capabilities: [],
		eg: "UNBLIND(k, m, SIGN(a, BLIND(k, m))): SIGN(a, m)",
		help: "Once `BLIND(k, m)` is signed by the signer, the sender can convert `SIGN(a, BLIND(k, m))` to `SIGN(a, m)` by unblinding the message using their secret blinding factor `k`. The resulting unblinded signature can then be used as if it were a regular signature by `a` over `m`."
	},
	{
		name: "SHAMIR_SPLIT",
		args: ["secret"],
		arity: [1], outputs: [3], checkable: false, capabilities: [],
		eg: "SHAMIR_SPLIT(k): s1, s2, s3",
		help: "In Verifpal, we allow splitting the key into three shares such that only two shares are required to reconstitute it."
	},
	{
		name: "SHAMIR_JOIN",
		args: ["share_a", "share_b"],
		arity: [2], outputs: [1], checkable: false, capabilities: [],
		eg: "SHAMIR_JOIN(sa, sb): k",
		help: "Here, sa and sb must be two distinct elements out of the set (s1, s2, s3) in order to obtain k."
	}
];

export interface Documented {
	name: string;
	eg: string;
	help: string;
}

export const CAPABILITIES: Documented[] = [
	{
		name: "weak",
		eg: "AEAD_ENC[weak](key, plaintext, ad)",
		help: "Declared weakening assumption: this primitive loses confidentiality, so holding the term is enough to recover what it protects. Declared for HASH and PW_HASH (a preimage, recovering every argument), AEAD_ENC, ENC and PKE_ENC (the plaintext), KEM_ENCAP (the shared secret), and PUBKEY (the private key, which is the discrete logarithm problem falling and makes every DH_KEX built on that key computable). Append `from phase N` to delay it."
	},
	{
		name: "forgeable",
		eg: "SIGN[forgeable](private_key, message)",
		help: "Declared weakening assumption: this primitive loses authenticity, so the term becomes constructible without its secret argument. Declared for SIGN, MAC, RINGSIGN and AEAD_ENC. Kept separate from `weak` so that AEAD_ENC[forgeable] can say the attacker may manufacture a ciphertext the recipient accepts while still being unable to read yours. Append `from phase N` to delay it."
	},
	{
		name: "malleable",
		eg: "ENC[malleable](key, plaintext)",
		help: "Declared weakening assumption: a ciphertext the attacker already holds can be retargeted into another the recipient still accepts, which is the symbolic shape of a bit-flipping attack. Declared only for ENC, the unauthenticated cipher this models, and only over its plaintext position: holding one `ENC(k, m)` the attacker may build `ENC(k, m')` for any `m'` it can construct, under a key it never learns. It licenses reshaping a ciphertext, not conjuring one, so the attacker must already hold a term of the same shape. Because malleability is an authenticity loss, an authenticated primitive is pointed at `forgeable` instead. Append `from phase N` to delay it."
	},
	{
		name: "from",
		eg: "PUBKEY[weak from phase 1](private_key)",
		help: "Delays a weakening assumption: it is not in force until the named phase, and holds from there onward. Cryptanalysis does not un-happen, which is why this reads `from` a phase rather than `in` one. A capability that arrives later than the message it would act on is no capability at all, since phases still govern when a value may be substituted."
	}
];

export const QUERIES: Documented[] = [
	{
		name: "confidentiality",
		eg: "confidentiality? a",
		help: "Checks whether a given value can be obtained by the attacker."
	},
	{
		name: "authentication",
		eg: "authentication? Alice -> Bob: m",
		help: "Checks whether Bob will rely on some value m in an important protocol operation (such as signature verification or authenticated decryption) if and only if he received that value from Alice. If Bob is successful in using m for signature verification or a similar operation without it having been necessarily sent by Alice, then authentication is violated for m, and the attacker was able to impersonate Alice in communicating that value."
	},
	{
		name: "freshness",
		eg: "freshness? a",
		help: "Freshness queries are useful for detecting replay attacks, where an attacker could manipulate one message to make it seem valid in two different contexts. In passive attacker mode, a freshness query will check whether a value is “fresh” between sessions (i.e. if it has at least one composing element that is generated, non-static). In active attacker mode, it will check whether a value can be rendered “non-fresh” (i.e. static between sessions) and subsequently successfully used between sessions."
	},
	{
		name: "unlinkability",
		eg: "unlinkability? a, b, c",
		help: "Checks whether all given values satisfy freshness. If they do, checks whether the attacker can determine them as being the output of the same primitive or as otherwise having a common source. If any of these checks fail, the query fails. Takes at least two distinct constants."
	},
	{
		name: "equivalence",
		eg: "equivalence? ss_a, ss_b",
		help: "Checks whether any protocol scenario can be derived such that the given values are not equivalent to one another. This query could be useful for checking if all parties derived the same shared secret, for example. Takes at least two distinct constants."
	},
	{
		name: "precondition",
		eg: "confidentiality? m[ precondition[ Bob -> Alice: ack ] ]",
		help: "An option that may be attached to any query. When the query fails, the result is additionally annotated to note that the message described in the precondition is sent despite the query failing. The sender must know the constant, the recipient must receive it, and the recipient must actually use it inside a primitive, or the model is rejected."
	}
];

export const KEYWORDS: Documented[] = [
	{
		name: "attacker",
		eg: "attacker[active]",
		help: "Declares the attacker model, and must be the first statement in a model. `active` lets the attacker inject and replace unguarded values on the wire; `passive` lets it only observe."
	},
	{
		name: "active",
		eg: "attacker[active]",
		help: "The attacker may observe every message, and may also inject or replace any value that is not guarded with `[ ]`."
	},
	{
		name: "passive",
		eg: "attacker[passive]",
		help: "The attacker may observe every message but may not modify or inject anything."
	},
	{
		name: "principal",
		eg: "principal Alice[ ... ]",
		help: "Declares a block of operations performed by one principal. A principal may be declared more than once; the blocks run in the order they appear. Principal names are title-cased, and a model may declare at most 128 of them."
	},
	{
		name: "knows",
		eg: "knows private a",
		help: "Declares a value the principal holds before the protocol begins. Qualify it with `public`, `private` or `password`."
	},
	{
		name: "generates",
		eg: "generates a",
		help: "Declares a fresh value, generated by this principal at this point in the protocol. Freshly generated values are what freshness queries are built on."
	},
	{
		name: "leaks",
		eg: "leaks a",
		help: "Hands a value the principal knows to the attacker. Useful for modelling key compromise, and for post-compromise properties when combined with phases."
	},
	{
		name: "public",
		eg: "knows public c0",
		help: "The value is known to every principal, and to the attacker."
	},
	{
		name: "private",
		eg: "knows private m",
		help: "The value is known only to the principals that declare it."
	},
	{
		name: "password",
		eg: "knows password pw",
		help: "A low-entropy private value. The attacker may brute-force it unless it is passed through PW_HASH before use."
	},
	{
		name: "phase",
		eg: "phase[1]",
		help: "Opens a new phase. Values sent in an earlier phase cannot be replaced using knowledge the attacker only obtains in a later one, which is what makes post-compromise properties expressible. Phases must increment by exactly one."
	},
	{
		name: "queries",
		eg: "queries[ confidentiality? m ]",
		help: "The block of security queries to check. It must exist, and nothing may follow it: a statement after the queries block is a hard error rather than something silently ignored."
	},
	{
		name: "nil",
		eg: "AEAD_ENC(k, m, nil)",
		help: "The empty value. Known to the attacker from the start, and the usual way to say “no associated data”."
	}
];

const PRIMITIVE_INDEX = new Map(PRIMITIVES.map((p) => [p.name, p]));
const CAPABILITY_INDEX = new Map(CAPABILITIES.map((c) => [c.name, c]));
const QUERY_INDEX = new Map(QUERIES.map((q) => [q.name, q]));
const KEYWORD_INDEX = new Map(KEYWORDS.map((k) => [k.name, k]));

export function lookupPrimitive(word: string): Primitive | undefined {
	return PRIMITIVE_INDEX.get(word.toUpperCase());
}

export function lookupCapability(word: string): Documented | undefined {
	return CAPABILITY_INDEX.get(word.toLowerCase());
}

export function lookupQuery(word: string): Documented | undefined {
	return QUERY_INDEX.get(word.toLowerCase());
}

export function lookupKeyword(word: string): Documented | undefined {
	return KEYWORD_INDEX.get(word.toLowerCase());
}

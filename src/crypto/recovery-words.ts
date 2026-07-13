import {
  entropyToMnemonic,
  mnemonicToEntropy,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { PPXError } from "../protocol/types";
import type { RecoveryWordCodec } from "./provider";

function canonicalMnemonic(words: string[]): string {
  if (words.length !== 24) throw new PPXError("impossible-length");
  const normalized = words.map((word) =>
    word.normalize("NFKD").trim().toLowerCase(),
  );
  if (normalized.some((word) => word.length === 0 || /\s/u.test(word))) {
    throw new PPXError("noncanonical-text");
  }
  return normalized.join(" ");
}

export function createRecoveryWordCodec(): RecoveryWordCodec {
  return {
    entropyToRecoveryWords(entropy32) {
      if (entropy32.byteLength !== 32) throw new PPXError("impossible-length");
      return entropyToMnemonic(entropy32, wordlist).split(" ");
    },
    recoveryWordsToEntropy(words) {
      const mnemonic = canonicalMnemonic(words);
      if (!validateMnemonic(mnemonic, wordlist)) {
        throw new PPXError("noncanonical-text");
      }
      const entropy = mnemonicToEntropy(mnemonic, wordlist);
      if (entropy.byteLength !== 32) throw new PPXError("impossible-length");
      return entropy;
    },
  };
}

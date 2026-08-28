export type PassphraseStrengthBand = "weak" | "medium" | "strong";

export function passphraseStrengthBand(bits: number): PassphraseStrengthBand {
  if (bits >= 100) return "strong";
  if (bits >= 50) return "medium";
  return "weak";
}

function characterPoolSize(value: string): number {
  let pool = 0;
  if (/\p{Ll}/u.test(value)) pool += 26;
  if (/\p{Lu}/u.test(value)) pool += 26;
  if (/\p{N}/u.test(value)) pool += 10;
  if (/\s/u.test(value)) pool += 1;
  if (/[^\p{L}\p{N}\s]/u.test(value)) pool += 33;
  if (/[^\x00-\x7F]/u.test(value)) pool += 100;
  return Math.max(pool, 1);
}

function repeatedUnitLength(value: string): number | null {
  for (let unit = 1; unit <= Math.floor(value.length / 2); unit += 1) {
    if (value.length % unit !== 0) continue;
    const pattern = value.slice(0, unit);
    if (pattern.repeat(value.length / unit) === value) return unit;
  }
  return null;
}

/** Local-only guidance; never a promise of crack time. */
export function estimatePassphraseBits(value: string): number {
  const characters = [...value.normalize("NFC")];
  if (characters.length === 0) return 0;
  const poolBits = Math.log2(characterPoolSize(value));
  let estimate = characters.length * poolBits;
  const compact = characters.join("").toLocaleLowerCase("en-US");
  const unitLength = repeatedUnitLength(compact);
  if (unitLength !== null) {
    estimate = Math.min(
      estimate,
      unitLength * poolBits + Math.log2(characters.length / unitLength + 1),
    );
  }
  if (/^(?:0123|1234|2345|3456|4567|5678|6789|7890|abcd|qwerty)/u.test(compact))
    estimate *= 0.65;
  if (/^(?:password|passwort|letmein|admin|welcome)$/u.test(compact))
    estimate = Math.min(estimate, 12);
  return Math.max(0, Math.floor(estimate));
}

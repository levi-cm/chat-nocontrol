const SENSITIVE_REPLACEMENT = "[sensitive PPX material removed]";
const DETECTION_LIMIT = 16_384;

const PRIVATE_TRANSPORT_MARKER =
  /PPX[12]:(?:CONTACT|MESSAGE|FILE|RECOVERY|PRIVATE):/iu;
const PRIVATE_OBJECT_HEADER = /PPX[CTMQFRV][\u0001\u0002][\u0001\u0002]/iu;
const SECRET_MARKER = /BEGIN PPX|#\/decrypt\/qr\/|#\/m\//iu;
const LIKELY_ENCRYPTED_LINK_PAYLOAD = /[A-Za-z0-9_-]{256,}/u;
const HEX_OBJECT_HEADER =
  /50[\s,:\[\]<>-]*50[\s,:\[\]<>-]*58[\s,:\[\]<>-]*(?:43|54|4d|51|46|52|56)[\s,:\[\]<>-]*0[12][\s,:\[\]<>-]*0[12]/iu;

const BASE45_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const OBJECT_KIND_BYTES = [0x43, 0x54, 0x4d, 0x51, 0x46, 0x52, 0x56];

function encodeBase45Prefix(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 2) {
    const value = (bytes[index] as number) * 256 + (bytes[index + 1] as number);
    output += BASE45_ALPHABET[value % 45];
    output += BASE45_ALPHABET[Math.floor(value / 45) % 45];
    output += BASE45_ALPHABET[Math.floor(value / (45 * 45))];
  }
  return output;
}

function encodeBase64Prefix(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

const ENCODED_OBJECT_PREFIXES = new Set<string>();
for (const kind of OBJECT_KIND_BYTES) {
  for (const formatVersion of [1, 2]) {
    for (const suite of [1, 2]) {
      const header = Uint8Array.of(
        0x50,
        0x50,
        0x58,
        kind,
        formatVersion,
        suite,
      );
      ENCODED_OBJECT_PREFIXES.add(encodeBase45Prefix(header));
      ENCODED_OBJECT_PREFIXES.add(encodeBase64Prefix(header));
    }
  }
}

function decodeEscapedBytes(value: string): string {
  return value
    .replaceAll(/\\u([0-9a-f]{4})/giu, (_match, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replaceAll(/\\x([0-9a-f]{2})/giu, (_match, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function diagnosticVariants(value: string): string[] {
  const variants = new Set<string>([value.slice(0, DETECTION_LIMIT)]);
  variants.add(decodeEscapedBytes(value.slice(0, DETECTION_LIMIT)));
  let percentDecoded = value.slice(0, DETECTION_LIMIT);
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const decoded = decodeURIComponent(percentDecoded);
      variants.add(decoded);
      variants.add(decodeEscapedBytes(decoded));
      if (decoded === percentDecoded) break;
      percentDecoded = decoded;
    } catch {
      break;
    }
  }
  return [...variants];
}

function containsEncodedObjectHeader(value: string): boolean {
  if (HEX_OBJECT_HEADER.test(value)) return true;
  for (const prefix of ENCODED_OBJECT_PREFIXES) {
    if (value.includes(prefix)) return true;
  }
  return false;
}

function containsSensitiveMaterial(value: string): boolean {
  return diagnosticVariants(value).some(
    (variant) =>
      SECRET_MARKER.test(variant) ||
      PRIVATE_TRANSPORT_MARKER.test(variant) ||
      PRIVATE_OBJECT_HEADER.test(variant) ||
      LIKELY_ENCRYPTED_LINK_PAYLOAD.test(variant) ||
      containsEncodedObjectHeader(variant),
  );
}

export function sanitizeDiagnosticText(value: string): string {
  if (containsSensitiveMaterial(value)) return SENSITIVE_REPLACEMENT;
  return value
    .replaceAll(/\b[0-9a-f]{40,}\b/giu, "[fingerprint removed]")
    .slice(0, 2_000);
}

import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";
import { createRecoveryDocumentModel } from "../src/flows/identity/recovery-artifacts";
import { generateRecoveryPdfBytes } from "../src/flows/identity/recovery-pdf";

const output = process.argv[2];
if (!output) {
  throw new Error("Usage: tsx scripts/render-recovery-pdf-fixture.ts <output.pdf>");
}

const recoveryCode = `PPX1:RECOVERY:${"ABCDE12345".repeat(120)}`;
const qrDataUrl = await QRCode.toDataURL(recoveryCode, {
  errorCorrectionLevel: "H",
  margin: 4,
  width: 768,
});
const model = createRecoveryDocumentModel({
  locale: "de",
  username: "Sicherer Beispielname",
  creationTime: 1_783_987_200n,
  recoveryCode,
  words: Array.from(
    { length: 24 },
    (_, index) => `wiederherstellungswort${index + 1}`,
  ),
  password: "Printable-Vault-Password-".repeat(10).slice(0, 256),
  qrDataUrl,
});

await writeFile(output, await generateRecoveryPdfBytes(model));

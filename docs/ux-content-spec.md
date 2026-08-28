> **Authority:** Normative EN/DE content contract for `0.2.0-beta.1`.
> **Depends on:** [product-spec.md](product-spec.md), [protocol-cat5-v2.md](protocol-cat5-v2.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md)

# UX content specification

## Global language

Use “beta”, “encrypt locally”, “public contact”, “private recovery”, and exact
artifact names. Never claim independently reviewed, quantum-proof, anonymous,
secure deletion, device verified, or deployed without evidence.

Target version: `0.2.0-beta.1`.

## Transport copy

| Context | English | German |
| --- | --- | --- |
| Share contact | Share contact file or text | Kontaktdatei oder -text teilen |
| Contact QR absence | CAT-5 contacts use file or text, not QR. | CAT-5-Kontakte nutzen Datei oder Text, keinen QR. |
| Share message | Copy encrypted link or PPXT text | Verschlüsselten Link oder PPXT-Text kopieren |
| Message QR absence | CAT-5 messages do not create QR codes. | CAT-5-Nachrichten erstellen keine QR-Codes. |
| Recovery warning | Private recovery — never share | Private Wiederherstellung — niemals teilen |
| Legacy link | Legacy V1 input: decrypt only | Alte V1-Eingabe: nur entschlüsseln |

Recovery QR remains and must always use private-danger styling. Public contact
file/text uses neutral share styling. Message armor/link uses encrypted-output
styling. Never visually label a V1 sender contact as saved/current.

## Legacy flow copy

English:

- “This older message can be decrypted here. No older app is required.”
- “Provide the sender’s exact V1 contact for this decrypt only. It will not be saved.”
- “Older private material will be upgraded to CAT-5/V2. Share your new contact afterward.”
- “New messages, contacts, vaults, and recovery files are always CAT-5/V2.”

German:

- „Diese alte Nachricht kann hier entschlüsselt werden. Die alte App ist nicht nötig.“
- „Gib den exakten V1-Absenderkontakt nur für diese Entschlüsselung an. Er wird nicht gespeichert.“
- „Altes privates Material wird auf CAT-5/V2 aktualisiert. Teile danach deinen neuen Kontakt.“
- „Neue Nachrichten, Kontakte, Tresore und Recovery-Dateien sind immer CAT-5/V2.“

## Errors

Show safe primary text, optional sanitized detail. Do not distinguish wrong
vault password from corruption. Distinguish unsupported legacy contact saving
from malformed data. Downgrade/mixed-suite input uses unsupported-format copy,
never fallback wording.

## PWA update copy

No update UI exists: no banner, toast, modal, choice, “reload now,” or deferred
prompt. Same-version clients stay open. During a version transition the app may
navigate once automatically into CAT5; no user action is offered. Help may
state: “Updates apply automatically. An open older version may restart once.” /
„Updates gelten automatisch. Eine offene ältere Version kann einmal neu
starten.“

## Status copy

Independent review: `BLOCKED — no qualifying evidence`. Physical-device test:
`NOT RUN — no qualifying device evidence`. Do not translate status tokens in
machine-readable evidence; explanatory UI text may be localized.

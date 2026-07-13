> **Authority:** Chat NoControl documentation authority; this file normatively defines the screen, flow, state, and copy contract for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [accessibility-i18n.md](accessibility-i18n.md), [user-guide.en.md](user-guide.en.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# UX and Content Specification

## 1. Contract rules

- English and German ship complete at launch.
- German uses friendly informal `du` consistently.
- Protocol strings, object names, magic values, and exact protocol labels are not translated.
- User-facing copy uses the product terms `identity`, `public contact`, `private recovery card`, `encrypted text`, and `encrypted file`.
- Never use `account` or `seed card` in user copy for these concepts.
- Visual style is not specified here beyond semantic distinctness, state visibility, and responsive behavior.

## 2. Global navigation

- Mobile navigation is bottom-aligned.
- Desktop navigation is a left rail.
- Nav items are Encrypt, Decrypt, Contacts, Identity, Help.
- The active destination must always be visibly clear without relying on color alone.
- The app should open on Create identity / Import identity for first-time use.
- When the user is ready to work, Encrypt is the first operational screen.

## 3. Identity setup flow

### 3.1 First screen

English:

- Title: `Create identity or import identity`
- Primary action: `Create new identity`
- Secondary action: `Import identity`

German:

- Title: `Identität erstellen oder importieren`
- Primary action: `Neue Identität erstellen`
- Secondary action: `Identität importieren`

### 3.2 Pseudonym step

English:

- Label: `Pseudonym`
- Helper: `This name is public and not unique. Use a fictional, recognizable name if you want one.`
- Error: `Enter a pseudonym between 1 and 48 UTF-8 bytes after normalization.`

German:

- Label: `Pseudonym`
- Helper: `Dieser Name ist öffentlich und nicht eindeutig. Nimm einen erfundenen, gut wiedererkennbaren Namen, wenn du einen verwenden willst.`
- Error: `Gib ein Pseudonym mit 1 bis 48 UTF-8-Bytes nach Normalisierung ein.`

### 3.3 Identity creation warnings

English:

- Warning title: `Public label, not a secret`
- Warning text: `Your pseudonym is visible to other people. It does not protect your identity.`
- Action: `Generate identity`

German:

- Warning title: `Öffentliches Label, kein Geheimnis`
- Warning text: `Dein Pseudonym ist für andere sichtbar. Es schützt deine Identität nicht.`
- Action: `Identität erzeugen`

### 3.4 Recovery and vault choice

English:

- Prompt: `Do you want to remember this identity on this device?`
- Option 1: `Yes, create an encrypted local vault`
- Option 2: `No, use session only`
- Warning title: `Private recovery card`
- Warning text: `This card is dangerous. Anyone who gets it can recover your private identity. Do not share it.`
- Warning action: `Press and hold to export private recovery card`
- Keyboard or switch alternative: `Focus the export action, activate it, type the confirmation phrase, then confirm. This path is not time-dependent.`
- Confirmation phrase: `EXPORT PRIVATE`
- Recovery confirmation title: `Confirm recovery words`
- Recovery confirmation helper: `The app will ask you to re-enter a few randomly selected word positions.`
- Recovery confirmation prompt: `Enter the word in position {n} of 24`
- Recovery confirmation note: `This does not reveal your words to anyone else.`
- Finish blocker: `Export the private recovery card before you finish.`
- Presentation rule: `Private export surfaces are danger-first and must never resemble the public contact card.`

German:

- Prompt: `Willst du dir diese Identität auf diesem Gerät merken?`
- Option 1: `Ja, verschlüsselten lokalen Tresor erstellen`
- Option 2: `Nein, nur für diese Sitzung verwenden`
- Warning title: `Private Wiederherstellungskarte`
- Warning text: `Diese Karte ist gefährlich. Wer sie bekommt, kann deine private Identität wiederherstellen. Teile sie nicht.`
- Warning action: `Zum Export der privaten Wiederherstellungskarte gedrückt halten`
- Keyboard- oder Schalter-Alternative: `Fokussiere die Exportaktion, aktiviere sie, gib PRIVAT EXPORTIEREN ein und bestätige.`
- Bestätigungsphrase: `PRIVAT EXPORTIEREN`
- Recovery confirmation title: `Wiederherstellungswörter bestätigen`
- Recovery confirmation helper: `Die App fordert dich auf, einige zufällig ausgewählte Wortpositionen erneut einzugeben.`
- Recovery confirmation prompt: `Gib das Wort an Position {n} von 24 ein`
- Recovery confirmation note: `Das zeigt deine Wörter niemand anderem.`
- Finish blocker: `Exportiere die private Wiederherstellungskarte, bevor du fertig bist.`
- Presentation rule: `Private Exportflächen sind auf Gefahr ausgelegt und dürfen nie wie die Karte des öffentlichen Kontakts wirken.` 

### 3.5 Identity import

English:

- Import sources: `Locked PPXV vault`, `Unencrypted PPXR recovery card or PPXR QR image`, `24 recovery words`
- Validation step: `Validate the imported material before continuing.`
- Words step: `Enter all 24 recovery words in English.`
- Words normalization: `The app normalizes the words with BIP39 NFKD and single ASCII spaces.`
- Words validation: `The words must be exactly 24 valid English words and the checksum must match.`
- PPXR warning: `This recovery material is unencrypted. Anyone who gets it can recover your private identity.`
- PPXV prompt: `Enter the vault passphrase.`
- Verification step: `Derive the identity and verify it matches the imported recovery material.`
- Pseudonym prompt: `Choose or re-enter a pseudonym for this identity.`
- Pseudonym note: `It may be different from the original, but the cryptographic identity fingerprint stays the same.`
- Creation-time note: `Import time is local metadata only and is not the original creation time.`
- Follow-up prompt: `Do you want to remember this identity on this device?`
- Scope note: `Public contacts are imported in Contacts.`

German:

- Importquellen: `Gesperrter PPXV-Tresor`, `Unverschlüsselte PPXR-Wiederherstellungskarte oder PPXR-QR-Bild`, `24 Wiederherstellungswörter`
- Prüfschritt: `Prüfe das importierte Material, bevor es weitergeht.`
- Wörter-Schritt: `Gib alle 24 Wiederherstellungswörter auf Englisch ein.`
- Wörter-Normalisierung: `Die App normalisiert die Wörter mit BIP39-NFKD und einzelnen ASCII-Leerzeichen.`
- Wörter-Prüfung: `Die Wörter müssen genau 24 gültige englische Wörter sein und die Prüfsumme muss passen.`
- PPXR-Warnung: `Dieses Wiederherstellungsmaterial ist unverschlüsselt. Wer es bekommt, kann deine private Identität wiederherstellen.`
- PPXV-Abfrage: `Gib die Tresor-Passphrase ein.`
- Verifizierungsschritt: `Leite die Identität ab und prüfe, ob sie zum importierten Wiederherstellungsmaterial passt.`
- Pseudonym-Abfrage: `Wähle ein Pseudonym für diese Identität oder gib es erneut ein.`
- Pseudonym-Hinweis: `Es darf anders sein als das ursprüngliche, aber der kryptografische Identitäts-Fingerabdruck bleibt gleich.`
- Erstellungszeit-Hinweis: `Die Importzeit ist nur lokale Metadaten und nicht die ursprüngliche Erstellungszeit.`
- Anschlussfrage: `Willst du dir diese Identität auf diesem Gerät merken?`
- Umfangshinweis: `Öffentliche Kontakte importierst du weiterhin im Bereich Kontakte.`

### 3.6 Private export variants

English:

- Encrypted private QR label: `Private identity vault`
- Encrypted private QR hint: `Encrypted PPXV`
- Unencrypted recovery QR label: `Private recovery card`
- Unencrypted recovery QR hint: `Dangerous PPXR`
- Public contact QR label: `Public contact`
- Public contact QR hint: `Non-dangerous PPXC`
- Export completion: `Recovery material exported`
- Shared treatment rule: `Both private exports are equally serious; PPXR uses the strongest warning and the deliberate export guard.`

German:

- Encrypted private QR label: `Privater Identitätstresor`
- Encrypted private QR hint: `Verschlüsseltes PPXV`
- Unencrypted recovery QR label: `Private Wiederherstellungskarte`
- Unencrypted recovery QR hint: `Gefährliches PPXR`
- Public contact QR label: `Öffentlicher Kontakt`
- Public contact QR hint: `Nicht gefährliches PPXC`
- Export completion: `Wiederherstellungsmaterial exportiert`
- Shared treatment rule: `Beide privaten Exporte sind gleich ernst; PPXR nutzt die stärkste Warnung und die bewusste Exportsicherung.`

### 3.7 Public contact card

English:

- Card title: `Public contact`
- Subheading order: pseudonym first, then QR
- Helper: `Share this contact so other people can encrypt to you.`

German:

- Card title: `Öffentlicher Kontakt`
- Subheading order: pseudonym first, then QR
- Helper: `Teile diesen Kontakt, damit andere dir verschlüsselt schreiben können.`

## 4. Encrypt flow

### 4.1 Main state

English:

- Empty state: `Choose a recipient to start encrypting`
- Search placeholder: `Search by pseudonym, nickname, or fingerprint`
- Mode toggle: `Text` / `File`
- Primary button: `Encrypt`

German:

- Empty state: `Wähle einen Empfänger aus, um zu verschlüsseln`
- Search placeholder: `Nach Pseudonym, Spitznamen oder Fingerabdruck suchen`
- Mode toggle: `Text` / `Datei`
- Primary button: `Verschlüsseln`

### 4.2 Text mode

English:

- Input label: `Encrypted text`
- Counter label: `Bytes used`
- Limit note: `Maximum plaintext: 256 KiB`
- Capability note: `Copy, save, or share when available`

German:

- Input label: `Verschlüsselter Text`
- Counter label: `Verwendete Bytes`
- Limit note: `Maximale Klartextgröße: 256 KiB`
- Capability note: `Kopieren, speichern oder teilen, wenn verfügbar`

### 4.3 File mode

English:

- Input label: `Encrypted file`
- Filename label: `File name`
- Caption label: `Caption`
- Limit note: `Maximum file size: 100 MiB`
- Limit note: `Caption optional, up to 16 KiB`
- Status: `File operations restart from the beginning if interrupted`

German:

- Input label: `Verschlüsselte Datei`
- Filename label: `Dateiname`
- Caption label: `Bildunterschrift`
- Limit note: `Maximale Dateigröße: 100 MiB`
- Limit note: `Bildunterschrift optional, bis zu 16 KiB`
- Status: `Dateivorgänge starten nach einer Unterbrechung von vorne neu`

### 4.4 Progress and cancel

English:

- Progress label: `Working`
- Cancel button: `Cancel`
- Cancel note: `The current operation will stop safely.`

German:

- Progress label: `In Arbeit`
- Cancel button: `Abbrechen`
- Cancel note: `Der aktuelle Vorgang wird sicher beendet.`

## 5. Decrypt flow

### 5.1 Entry state

English:

- Drop area: `Paste, drop, or choose a file`
- Helper: `The app will route armor or file automatically.`
- Primary title after load: `Decrypt`

German:

- Drop area: `Einfügen, ablegen oder eine Datei auswählen`
- Helper: `Die App leitet Text oder Datei automatisch weiter.`
- Primary title after load: `Entschlüsseln`

### 5.2 Safe failures

English:

- Safe failure title: `Could not decrypt`
- Safe failure text for wrong recipient: `This item does not match your active identity or is damaged.`
- Safe failure text for bad signature: `The item decrypted, but the sender check failed.`
- Expander title: `Technical details`

German:

- Safe failure title: `Entschlüsselung nicht möglich`
- Safe failure text for wrong recipient: `Dieses Element passt nicht zu deiner aktiven Identität oder ist beschädigt.`
- Safe failure text for bad signature: `Das Element wurde entschlüsselt, aber die Absenderprüfung ist fehlgeschlagen.`
- Expander title: `Technische Details`

### 5.3 Success states

English:

- Sender warning: `Unknown sender`
- Sender warning text: `This message is cryptographically valid, but you have not saved this sender yet.`
- Save sender action: `Save contact`
- File preview note: `Preview only after full authentication`

German:

- Sender warning: `Unbekannter Absender`
- Sender warning text: `Diese Nachricht ist kryptografisch gültig, aber du hast diesen Absender noch nicht gespeichert.`
- Save sender action: `Kontakt speichern`
- File preview note: `Vorschau nur nach vollständiger Authentifizierung`

## 6. Contacts flow

English:

- Screen title: `Contacts`
- Empty state: `No contacts yet`
- Local nickname label: `Nickname`
- Path: `Contact details > Delete contact > confirmation`
- Contact details action: `Delete contact`
- Delete confirmation title: `Delete contact?`
- Delete confirmation text: `This removes only the local public contact and nickname. It does not delete external files or your identity. You can import this contact again later.`
- Merge note: `This contact key is already saved. The entry was merged.`
- Collision warning: `Same pseudonym, different key`
- Collision note: `Keep both entries separate until you verify which one you want.`

German:

- Screen title: `Kontakte`
- Empty state: `Noch keine Kontakte`
- Local nickname label: `Spitzname`
- Pfad: `Kontaktdetails > Kontakt löschen > Bestätigung`
- Contact details action: `Kontakt löschen`
- Delete confirmation title: `Kontakt löschen?`
- Delete confirmation text: `Dadurch werden nur der lokale öffentliche Kontakt und der Spitzname entfernt. Externe Dateien oder deine Identität werden nicht gelöscht. Du kannst diesen Kontakt später erneut importieren.`
- Merge note: `Dieser Kontaktschlüssel ist bereits gespeichert. Der Eintrag wurde zusammengeführt.`
- Collision warning: `Gleiches Pseudonym, anderer Schlüssel`
- Collision note: `Lass beide Einträge getrennt, bis du geprüft hast, welchen du behalten willst.`

## 7. Identity and storage states

English:

- State title: `Session only`
- State text: `Nothing will be kept after you close the app.`
- Storage-denied fallback: `Storage is unavailable, so this session will not be remembered.`
- Lock button: `Lock now`
- Delete vault button: `Delete vault`
- Delete all button: `Erase everything`

German:

- State title: `Nur Sitzung`
- State text: `Nichts bleibt erhalten, wenn du die App schließt.`
- Storage-denied fallback: `Speicher ist nicht verfügbar, deshalb wird sich diese Sitzung nicht merken.`
- Lock button: `Jetzt sperren`
- Delete vault button: `Tresor löschen`
- Delete all button: `Alles löschen`

## 8. Update and offline states

English:

- Update banner: `A newer version is available.`
- Update banner action: `Review later`
- Offline state: `You are offline, but this session can keep working.`

German:

- Update banner: `Eine neuere Version ist verfügbar.`
- Update banner action: `Später ansehen`
- Offline state: `Du bist offline, aber diese Sitzung kann weiterarbeiten.`

## 9. Help and About

English:

- Help title: `Help`
- About title: `About`
- Claim: `Encrypts on this device. No online account.`
- Limitation: `Version 1 has no forward secrecy.`
- Limitation: `User names are only labels and are not unique.`
- Limitation: `Chat NoControl hides content, not metadata.`
- Limitation: `There is no password reset.`
- Issue action: `Report a problem`
- Source action: `View source and build info`
- Explainer link: `Dedicated chat-control explainer`

German:

- Help title: `Hilfe`
- About title: `Über`
- Claim: `Verschlüsselt auf diesem Gerät. Kein Online-Konto.`
- Limitation: `Version 1 hat kein Forward Secrecy.`
- Limitation: `Namen sind nur Labels und nicht eindeutig.`
- Limitation: `Chat NoControl versteckt Inhalt, nicht Metadaten.`
- Limitation: `Es gibt keine Passwortzurücksetzung.`
- Issue action: `Problem melden`
- Source action: `Quellcode und Build-Infos anzeigen`
- Explainer link: `Dedizierter Chat-Control-Erklärtext`

## 10. Critical string catalog

The following strings are exact and may be reused in English or German UI where the product requires a fixed phrase:

- `A newer version is available.`
- `Export the private recovery card before you finish.`
- `This card is dangerous. Anyone who gets it can recover your private identity. Do not share it.`
- `This item does not match your active identity or is damaged.`
- `The item decrypted, but the sender check failed.`
- `Storage is unavailable, so this session will not be remembered.`
- `This contact key is already saved. The entry was merged.`
- `Same pseudonym, different key`
- `Unknown sender`
- `Encrypts on this device. No online account.`

## 11. Responsive behavior

- On narrow screens, primary actions stay reachable without horizontal scrolling.
- No critical action may depend on hover.
- The navigation rail collapses into bottom navigation on mobile widths.
- The identity card, warnings, and primary action buttons must remain readable at 200% zoom and high reflow.
- Camera and scan controls must remain reachable with one-handed mobile use.

## 12. State and copy acceptance

The UX spec is accepted only if:

- All critical warnings and errors appear in both English and German.
- The German copy uses natural `du` phrasing.
- The public/private card distinction is unmissable in copy and flow.
- The decrypt flow stays safe-first and does not expose raw technical details by default.
- The copy contract matches the product and design specs without inventing accounts, seed cards, or message history.

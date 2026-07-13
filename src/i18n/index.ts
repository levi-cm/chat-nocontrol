export type Locale = "en" | "de";

const en = {
  brand: "Chat NoControl",
  language: "Language",
  english: "English",
  german: "Deutsch",
  primaryNav: "Primary",
  loadingStorage: "Loading local storage...",
  navEncrypt: "Encrypt",
  navDecrypt: "Decrypt",
  navContacts: "Contacts",
  navIdentity: "Identity",
  navHelp: "Help",
  localOnly: "On-device only",
  firstTitle: "Create identity or import identity",
  firstBody:
    "No account. Your private identity stays on this device unless you export it.",
  createIdentity: "Create new identity",
  importIdentity: "Import identity",
  publicPrivateTitle: "Know what to share",
  publicLabel: "Public contact",
  publicAuthority: "Safe to share",
  publicQrAlt: "Public contact QR code",
  downloadContact: "Download public contact",
  publicContactHelper: "Share this contact so other people can encrypt to you.",
  publicContactHint: "Non-dangerous PPXC",
  publicBody: "Safe to share. Others use it to encrypt items for you.",
  privateLabel: "Private recovery card",
  privateAuthority: "Private secret",
  recoveryQrAlt: "Private recovery QR code",
  vaultTitle: "Private identity vault",
  vaultWarning:
    "This vault is encrypted, but it still contains your private identity. Keep it private.",
  vaultQrAlt: "Encrypted private identity vault QR code",
  downloadVault: "Download encrypted vault",
  vaultHint: "Encrypted PPXV",
  privateBody: "Keep secret. Anyone who has it can recover your identity.",
  encryptTitle: "Encrypt",
  encryptBody: "Choose one contact, then encrypt text or one file locally.",
  decryptTitle: "Decrypt",
  decryptBody:
    "Paste encrypted text or choose an encrypted file. Validation happens before content appears.",
  contactsTitle: "Contacts",
  contactsBody:
    "Public contacts live only in this browser. You can remove them at any time.",
  identityTitle: "Identity",
  identityBody:
    "Create or import one active identity. Recovery export is required before setup finishes.",
  helpTitle: "Help",
  helpBody:
    "Chat NoControl encrypts content on this device. It does not hide metadata or protect a compromised browser.",
  noBackend: "No backend",
  noTelemetry: "No analytics or telemetry",
  noHistory: "No message history",
  betaWarning:
    "Public beta target. Independent security review is still required.",
  pseudonym: "Pseudonym",
  pseudonymHint:
    "This name is public and not unique. Use a fictional, recognizable name if you want one.",
  pseudonymError:
    "Enter a pseudonym between 1 and 48 UTF-8 bytes after normalization.",
  pseudonymWarningTitle: "Public label, not a secret",
  pseudonymWarningText:
    "Your pseudonym is visible to other people. It does not protect your identity.",
  generateIdentity: "Generate identity",
  creatingIdentity: "Creating identity on this device...",
  recoveryTitle: "Private recovery card",
  recoveryWarning:
    "This card is dangerous. Anyone who gets it can recover your private identity. Do not share it.",
  recoveryWordsTitle: "24 recovery words",
  recoveryWordsWarning: "These words are equally private. Store them offline.",
  downloadRecovery: "Press and hold to export private recovery card",
  recoveryExportKeyboard:
    "Focus the export action, activate it, type the confirmation phrase, then confirm. This path is not time-dependent.",
  holdExportProgress: "Keep holding to export private recovery card.",
  recoveryHint: "Dangerous PPXR",
  recoveryExportBlocker: "Export the private recovery card before you finish.",
  confirmationLabel: "Type EXPORT PRIVATE to continue",
  confirmationPhrase: "EXPORT PRIVATE",
  confirmRecovery: "Confirm recovery saved",
  confirmWordsTitle: "Confirm recovery words",
  confirmWordsHelper:
    "The app will ask you to re-enter a few randomly selected word positions.",
  confirmWordsNote: "This does not reveal your words to anyone else.",
  confirmWordPosition: "Enter the word in position {n} of 24",
  rememberTitle: "Do you want to remember this identity on this device?",
  rememberBody:
    "Session only keeps nothing after this app closes. Remembering stores only an encrypted vault.",
  useSessionOnly: "No, use session only",
  sessionOnlyTitle: "Session only",
  sessionOnlyText: "Nothing will be kept after you close the app.",
  storageUnavailable:
    "Storage is unavailable, so this session will not be remembered.",
  rememberDevice: "Yes, create an encrypted local vault",
  passphrase: "Vault passphrase",
  passphraseHint:
    "Use 12 to 256 UTF-8 bytes; 16+ characters or 5+ random words is recommended.",
  passphraseError: "Use a passphrase between 12 and 256 UTF-8 bytes.",
  saveEncryptedVault: "Save encrypted vault",
  identityReady: "Identity ready",
  back: "Back",
  setupError: "Could not create identity",
  importWords: "Import recovery words",
  recoveryFile: "Private recovery file",
  recoveryImportWarning:
    "This recovery material is unencrypted. Anyone who gets it can recover your private identity.",
  importFile: "Import private file",
  importError: "Could not import this identity",
  importErrorSummaryTitle: "Check identity import",
  contactPayload: "Public contact payload",
  contactFile: "Public contact file",
  nickname: "Nickname",
  saveContact: "Save public contact",
  contactsEmpty: "No contacts yet",
  mergeNote: "This contact key is already saved. The entry was merged.",
  collisionWarning: "Same pseudonym, different key",
  collisionNote:
    "Keep both entries separate until you verify which one you want.",
  deleteContact: "Delete contact",
  deleteContactTitle: "Delete contact?",
  deleteContactConfirm:
    "This removes only the local public contact and nickname. It does not delete external files or your identity. You can import this contact again later.",
  cancel: "Cancel",
  cancelOperation: "Cancel",
  operationProgress: "Working",
  cancelNote: "The current operation will stop safely.",
  operationCancelled: "Operation cancelled.",
  delete: "Delete",
  lockNow: "Lock now",
  unlockRemembered: "Unlock remembered identity",
  unlockIdentity: "Unlock identity",
  unlockError: "Could not unlock this identity",
  deleteVault: "Delete vault",
  deleteVaultConfirm:
    "Delete the encrypted identity vault from this device? Recovery material is required to restore it.",
  eraseAll: "Erase everything",
  eraseAllConfirm:
    "Erase the encrypted vault, public contacts, and local settings from this device?",
  invalidContact: "This public contact is invalid or damaged.",
  privateQrRejected:
    "Private recovery material cannot be imported as a public contact. It was cleared.",
  scanQrTitle: "Scan a QR code",
  qrImage: "QR image",
  scanWithCamera: "Scan with camera",
  stopCamera: "Stop camera",
  cameraPreview: "QR camera preview",
  cameraUnavailable: "Camera scanning is unavailable.",
  qrScanError: "Could not read this QR image.",
  importScannedQr: "Import scanned QR",
  fingerprint: "Fingerprint",
  shortIdentityId: "Short identity ID",
  recipient: "Recipient",
  chooseRecipient: "Choose a recipient to start encrypting",
  chooseEncryptMode: "Choose text or file",
  textMode: "Text",
  fileMode: "File",
  searchContacts: "Search by pseudonym, nickname, or fingerprint",
  encryptedTextLabel: "Encrypted text",
  bytesUsed: "Bytes used",
  maximumText: "Maximum plaintext: 256 KiB",
  textCapabilityNote: "Copy, save, or share when available",
  couldNotEncrypt: "Could not encrypt",
  encryptLocally: "Encrypt",
  encryptedOutput: "Encrypted output",
  copyOutput: "Copy encrypted output",
  copySucceeded: "Copied. Clipboard clearing after 60 seconds is best effort.",
  copyFailed: "Could not copy. Select the encrypted output manually.",
  saveOutput: "Save encrypted output",
  shareOutput: "Share encrypted output",
  identityRequired: "Create or import an identity first.",
  noContactsYet: "Import a public contact before encrypting.",
  encryptFileTitle: "Encrypt a file",
  fileToEncrypt: "Encrypted file",
  fileName: "File name",
  fileCaption: "Caption",
  captionBytes: "Caption bytes",
  maximumCaption: "Caption optional, up to 16 KiB",
  captionTooLarge: "Keep the caption at or below 16 KiB in UTF-8.",
  maximumFile: "Maximum file size: 100 MiB",
  fileRestartNote: "File operations restart from the beginning if interrupted",
  encryptFileLocally: "Encrypt",
  cancelFileOperation: "Cancel",
  fileProgress: "Working",
  bytes: "bytes",
  fileTooLarge: "Choose a file no larger than 100 MiB.",
  fileEncryptedDownloaded: "Encrypted file downloaded.",
  fileEncryptedReady: "Encrypted file ready.",
  downloadEncryptedFile: "Download encrypted file",
  shareEncryptedFile: "Share encrypted file",
  fileCancelled: "File operation cancelled.",
  fileEncryptError: "Could not encrypt this file.",
  encryptedItem: "Encrypted item",
  smartDecryptPrompt: "Paste, drop, or choose a file",
  smartDecryptHelper: "The app will route armor or file automatically.",
  encryptedInputTooLarge: "The encrypted text is too large to import.",
  selectedFile: "Selected file",
  decryptLocally: "Decrypt locally",
  couldNotDecrypt: "Could not decrypt",
  wrongIdentityOrDamaged:
    "This item does not match your active identity or is damaged.",
  badSignature: "The item decrypted, but the sender check failed.",
  technicalDetails: "Technical details",
  technicalFailureCode: "Validation failed before content release.",
  decryptedText: "Decrypted text",
  unknownSender: "Unknown sender",
  authenticatedSender: "Authenticated sender",
  sender: "Sender",
  contactStatus: "Contact status",
  knownSender: "Known contact",
  verifySenderGuidance:
    "Verify the short identity ID or fingerprint through a trusted channel. Pseudonyms are not unique.",
  unknownSenderText:
    "This message is cryptographically valid, but you have not saved this sender yet.",
  decryptFileTitle: "Decrypt a file",
  encryptedFile: "Encrypted file",
  decryptFileLocally: "Decrypt file locally",
  decryptedFile: "Decrypted file",
  filename: "Filename",
  caption: "Caption",
  filePreview: "Validated local file preview",
  previewAfterAuthentication: "Preview only after full authentication",
  previewUnavailable:
    "No safe inline preview is available. Download the validated file to open it.",
  downloadDecryptedFile: "Download decrypted file",
  unknownSenderFileText:
    "This file is cryptographically valid, but you have not saved this sender yet.",
  saveSender: "Save contact",
  verifyFingerprintGuidance:
    "Verify this fingerprint through a trusted channel when authenticity matters.",
  diagnosticsTitle: "Local diagnostics",
  diagnosticsBody:
    "Generate a sanitized report on this device. Review it before sharing.",
  generateDiagnostics: "Generate local diagnostics",
  reportProblem: "Report a problem",
  viewSourceBuild: "View source and build info",
  sourceBuildInfo:
    "Static local-first build. Source repository and signed release evidence:",
  diagnosticsReview: "Diagnostics report for review",
  openIssueDraft: "Open reviewed issue draft",
  downloadIssueDraft: "Download reviewed issue draft",
  issueTargetUnavailable:
    "No GitHub repository is configured. Download the reviewed draft instead.",
  newerVersion: "A newer version is available.",
  reviewLater: "Review later",
  offlineState: "You are offline, but this session can keep working.",
  storageFallback:
    "Persistent storage became unavailable. This session continues in memory.",
  deletionNotConfirmed:
    "Persistent storage failed. The requested deletion could not be confirmed on this device.",
  aboutTitle: "About",
  aboutClaim: "Encrypts on this device. No online account.",
  noForwardSecrecy: "Version 1 has no forward secrecy.",
  namesAreLabels: "User names are only labels and are not unique.",
  contentNotMetadata: "Chat NoControl hides content, not metadata.",
  noPasswordReset: "There is no password reset.",
  identityLossWarning:
    "Losing both private identity material and recovery material permanently loses access.",
  exactSecurityClaim:
    "PPX v1 combines ML-KEM-512 and X25519 confidentiality with classical Ed25519 sender authentication.",
  securityNonclaims:
    "No ratchet, no forward secrecy, no post-compromise secrecy, no verified-identity claim, no stable release, and no promise of quantum-proof, Signal-equivalent, or guaranteed secure deletion.",
  readChatControlExplainer: "Read the dedicated chat-control explainer",
  privateSecurityReports:
    "Report security or privacy vulnerabilities privately through GitHub Security Advisories, not a public issue.",
  reportSecurityPrivately: "Report a vulnerability privately",
  chatControlTitle: "Dedicated chat-control explainer",
  chatControlBody:
    "Child protection and private communications are compatible. This project opposes generalized scanning of private communications; it does not oppose child protection. The app provides local encryption only. It does not hide metadata, provide legal evasion, or act as a relay.",
} as const;

const de: Record<keyof typeof en, string> = {
  brand: "Chat NoControl",
  language: "Sprache",
  english: "English",
  german: "Deutsch",
  primaryNav: "Hauptnavigation",
  loadingStorage: "Lokaler Speicher wird geladen...",
  navEncrypt: "Verschlüsseln",
  navDecrypt: "Entschlüsseln",
  navContacts: "Kontakte",
  navIdentity: "Identität",
  navHelp: "Hilfe",
  localOnly: "Nur auf diesem Gerät",
  firstTitle: "Identität erstellen oder importieren",
  firstBody:
    "Kein Konto. Deine private Identität bleibt auf diesem Gerät, außer du exportierst sie.",
  createIdentity: "Neue Identität erstellen",
  importIdentity: "Identität importieren",
  publicPrivateTitle: "Erkenne, was du teilen darfst",
  publicLabel: "Öffentlicher Kontakt",
  publicAuthority: "Darf geteilt werden",
  publicQrAlt: "QR-Code des öffentlichen Kontakts",
  downloadContact: "Öffentlichen Kontakt herunterladen",
  publicContactHelper:
    "Teile diesen Kontakt, damit andere dir verschlüsselt schreiben können.",
  publicContactHint: "Nicht gefährliches PPXC",
  publicBody:
    "Darf geteilt werden. Andere verschlüsseln damit Elemente für dich.",
  privateLabel: "Private Wiederherstellungskarte",
  privateAuthority: "Privates Geheimnis",
  recoveryQrAlt: "QR-Code der privaten Wiederherstellung",
  vaultTitle: "Privater Identitätstresor",
  vaultWarning:
    "Dieser Tresor ist verschlüsselt, enthält aber weiterhin deine private Identität. Halte ihn privat.",
  vaultQrAlt: "QR-Code des verschlüsselten privaten Identitätstresors",
  downloadVault: "Verschlüsselten Tresor herunterladen",
  vaultHint: "Verschlüsseltes PPXV",
  privateBody:
    "Geheim halten. Wer sie besitzt, kann deine Identität wiederherstellen.",
  encryptTitle: "Verschlüsseln",
  encryptBody:
    "Wähle einen Kontakt und verschlüssele Text oder eine Datei lokal.",
  decryptTitle: "Entschlüsseln",
  decryptBody:
    "Füge verschlüsselten Text ein oder wähle eine verschlüsselte Datei. Inhalte erscheinen erst nach der Prüfung.",
  contactsTitle: "Kontakte",
  contactsBody:
    "Öffentliche Kontakte bleiben nur in diesem Browser. Du kannst sie jederzeit löschen.",
  identityTitle: "Identität",
  identityBody:
    "Erstelle oder importiere eine aktive Identität. Vor Abschluss ist ein Wiederherstellungsexport erforderlich.",
  helpTitle: "Hilfe",
  helpBody:
    "Chat NoControl verschlüsselt Inhalte auf diesem Gerät. Metadaten oder ein kompromittierter Browser werden nicht geschützt.",
  noBackend: "Kein Backend",
  noTelemetry: "Keine Analyse oder Telemetrie",
  noHistory: "Kein Nachrichtenverlauf",
  betaWarning:
    "Ziel ist eine öffentliche Beta. Eine unabhängige Sicherheitsprüfung ist noch erforderlich.",
  pseudonym: "Pseudonym",
  pseudonymHint:
    "Dieser Name ist öffentlich und nicht eindeutig. Nimm einen erfundenen, gut wiedererkennbaren Namen, wenn du einen verwenden willst.",
  pseudonymError:
    "Gib ein Pseudonym mit 1 bis 48 UTF-8-Bytes nach Normalisierung ein.",
  pseudonymWarningTitle: "Öffentliches Label, kein Geheimnis",
  pseudonymWarningText:
    "Dein Pseudonym ist für andere sichtbar. Es schützt deine Identität nicht.",
  generateIdentity: "Identität erzeugen",
  creatingIdentity: "Identität wird auf diesem Gerät erstellt...",
  recoveryTitle: "Private Wiederherstellungskarte",
  recoveryWarning:
    "Diese Karte ist gefährlich. Wer sie bekommt, kann deine private Identität wiederherstellen. Teile sie nicht.",
  recoveryWordsTitle: "24 Wiederherstellungswörter",
  recoveryWordsWarning:
    "Diese Wörter sind genauso privat. Bewahre sie offline auf.",
  downloadRecovery:
    "Zum Export der privaten Wiederherstellungskarte gedrückt halten",
  recoveryExportKeyboard:
    "Fokussiere die Exportaktion, aktiviere sie, gib PRIVAT EXPORTIEREN ein und bestätige.",
  holdExportProgress:
    "Weiter gedrückt halten, um die private Wiederherstellungskarte zu exportieren.",
  recoveryHint: "Gefährliches PPXR",
  recoveryExportBlocker:
    "Exportiere die private Wiederherstellungskarte, bevor du fertig bist.",
  confirmationLabel: "Tippe PRIVAT EXPORTIEREN zum Fortfahren",
  confirmationPhrase: "PRIVAT EXPORTIEREN",
  confirmRecovery: "Gespeicherte Wiederherstellung bestätigen",
  confirmWordsTitle: "Wiederherstellungswörter bestätigen",
  confirmWordsHelper:
    "Die App fordert dich auf, einige zufällig ausgewählte Wortpositionen erneut einzugeben.",
  confirmWordsNote: "Das zeigt deine Wörter niemand anderem.",
  confirmWordPosition: "Gib das Wort an Position {n} von 24 ein",
  rememberTitle: "Willst du dir diese Identität auf diesem Gerät merken?",
  rememberBody:
    "Nur Sitzung behält nach dem Schließen nichts. Beim Merken wird nur ein verschlüsselter Tresor gespeichert.",
  useSessionOnly: "Nein, nur für diese Sitzung verwenden",
  sessionOnlyTitle: "Nur Sitzung",
  sessionOnlyText: "Nichts bleibt erhalten, wenn du die App schließt.",
  storageUnavailable:
    "Speicher ist nicht verfügbar, deshalb wird sich diese Sitzung nicht merken.",
  rememberDevice: "Ja, verschlüsselten lokalen Tresor erstellen",
  passphrase: "Tresor-Passphrase",
  passphraseHint:
    "Nutze 12 bis 256 UTF-8-Bytes; empfohlen sind mindestens 16 Zeichen oder 5 zufällige Wörter.",
  passphraseError: "Nutze eine Passphrase mit 12 bis 256 UTF-8-Bytes.",
  saveEncryptedVault: "Verschlüsselten Tresor speichern",
  identityReady: "Identität bereit",
  back: "Zurück",
  setupError: "Identität konnte nicht erstellt werden",
  importWords: "Wiederherstellungswörter importieren",
  recoveryFile: "Private Wiederherstellungsdatei",
  recoveryImportWarning:
    "Dieses Wiederherstellungsmaterial ist unverschlüsselt. Wer es bekommt, kann deine private Identität wiederherstellen.",
  importFile: "Private Datei importieren",
  importError: "Diese Identität konnte nicht importiert werden",
  importErrorSummaryTitle: "Identitätsimport prüfen",
  contactPayload: "Nutzlast des öffentlichen Kontakts",
  contactFile: "Datei des öffentlichen Kontakts",
  nickname: "Spitzname",
  saveContact: "Öffentlichen Kontakt speichern",
  contactsEmpty: "Noch keine Kontakte",
  mergeNote:
    "Dieser Kontaktschlüssel ist bereits gespeichert. Der Eintrag wurde zusammengeführt.",
  collisionWarning: "Gleiches Pseudonym, anderer Schlüssel",
  collisionNote:
    "Lass beide Einträge getrennt, bis du geprüft hast, welchen du behalten willst.",
  deleteContact: "Kontakt löschen",
  deleteContactTitle: "Kontakt löschen?",
  deleteContactConfirm:
    "Dadurch werden nur der lokale öffentliche Kontakt und der Spitzname entfernt. Externe Dateien oder deine Identität werden nicht gelöscht. Du kannst diesen Kontakt später erneut importieren.",
  cancel: "Abbrechen",
  cancelOperation: "Abbrechen",
  operationProgress: "In Arbeit",
  cancelNote: "Der aktuelle Vorgang wird sicher beendet.",
  operationCancelled: "Vorgang abgebrochen.",
  delete: "Löschen",
  lockNow: "Jetzt sperren",
  unlockRemembered: "Gespeicherte Identität entsperren",
  unlockIdentity: "Identität entsperren",
  unlockError: "Diese Identität konnte nicht entsperrt werden",
  deleteVault: "Tresor löschen",
  deleteVaultConfirm:
    "Den verschlüsselten Identitätstresor von diesem Gerät löschen? Zur Wiederherstellung wird das Wiederherstellungsmaterial benötigt.",
  eraseAll: "Alles löschen",
  eraseAllConfirm:
    "Verschlüsselten Tresor, öffentliche Kontakte und lokale Einstellungen von diesem Gerät löschen?",
  invalidContact: "Dieser öffentliche Kontakt ist ungültig oder beschädigt.",
  privateQrRejected:
    "Privates Wiederherstellungsmaterial kann nicht als öffentlicher Kontakt importiert werden. Es wurde entfernt.",
  scanQrTitle: "QR-Code scannen",
  qrImage: "QR-Bild",
  scanWithCamera: "Mit Kamera scannen",
  stopCamera: "Kamera stoppen",
  cameraPreview: "QR-Kameravorschau",
  cameraUnavailable: "Das Scannen mit der Kamera ist nicht verfügbar.",
  qrScanError: "Dieses QR-Bild konnte nicht gelesen werden.",
  importScannedQr: "Gescannten QR-Code importieren",
  fingerprint: "Fingerabdruck",
  shortIdentityId: "Kurze Identitäts-ID",
  recipient: "Empfänger",
  chooseRecipient: "Wähle einen Empfänger aus, um zu verschlüsseln",
  chooseEncryptMode: "Text oder Datei wählen",
  textMode: "Text",
  fileMode: "Datei",
  searchContacts: "Nach Pseudonym, Spitznamen oder Fingerabdruck suchen",
  encryptedTextLabel: "Verschlüsselter Text",
  bytesUsed: "Verwendete Bytes",
  maximumText: "Maximale Klartextgröße: 256 KiB",
  textCapabilityNote: "Kopieren, speichern oder teilen, wenn verfügbar",
  couldNotEncrypt: "Verschlüsselung nicht möglich",
  encryptLocally: "Verschlüsseln",
  encryptedOutput: "Verschlüsselte Ausgabe",
  copyOutput: "Verschlüsselte Ausgabe kopieren",
  copySucceeded:
    "Kopiert. Das Löschen der Zwischenablage nach 60 Sekunden ist nur ein bestmöglicher Versuch.",
  copyFailed:
    "Kopieren nicht möglich. Wähle die verschlüsselte Ausgabe manuell aus.",
  saveOutput: "Verschlüsselte Ausgabe speichern",
  shareOutput: "Verschlüsselte Ausgabe teilen",
  identityRequired: "Erstelle oder importiere zuerst eine Identität.",
  noContactsYet: "Importiere vor dem Verschlüsseln einen öffentlichen Kontakt.",
  encryptFileTitle: "Datei verschlüsseln",
  fileToEncrypt: "Verschlüsselte Datei",
  fileName: "Dateiname",
  fileCaption: "Bildunterschrift",
  captionBytes: "Bytes der Beschriftung",
  maximumCaption: "Bildunterschrift optional, bis zu 16 KiB",
  captionTooLarge: "Halte die Beschriftung in UTF-8 bei höchstens 16 KiB.",
  maximumFile: "Maximale Dateigröße: 100 MiB",
  fileRestartNote:
    "Dateivorgänge starten nach einer Unterbrechung von vorne neu",
  encryptFileLocally: "Verschlüsseln",
  cancelFileOperation: "Abbrechen",
  fileProgress: "In Arbeit",
  bytes: "Bytes",
  fileTooLarge: "Wähle eine Datei mit höchstens 100 MiB.",
  fileEncryptedDownloaded: "Verschlüsselte Datei heruntergeladen.",
  fileEncryptedReady: "Verschlüsselte Datei ist bereit.",
  downloadEncryptedFile: "Verschlüsselte Datei herunterladen",
  shareEncryptedFile: "Verschlüsselte Datei teilen",
  fileCancelled: "Dateivorgang abgebrochen.",
  fileEncryptError: "Diese Datei konnte nicht verschlüsselt werden.",
  encryptedItem: "Verschlüsseltes Element",
  smartDecryptPrompt: "Einfügen, ablegen oder eine Datei auswählen",
  smartDecryptHelper: "Die App leitet Text oder Datei automatisch weiter.",
  encryptedInputTooLarge:
    "Der verschlüsselte Text ist zu groß zum Importieren.",
  selectedFile: "Ausgewählte Datei",
  decryptLocally: "Lokal entschlüsseln",
  couldNotDecrypt: "Entschlüsselung nicht möglich",
  wrongIdentityOrDamaged:
    "Dieses Element passt nicht zu deiner aktiven Identität oder ist beschädigt.",
  badSignature:
    "Das Element wurde entschlüsselt, aber die Absenderprüfung ist fehlgeschlagen.",
  technicalDetails: "Technische Details",
  technicalFailureCode:
    "Die Prüfung ist fehlgeschlagen, bevor Inhalte freigegeben wurden.",
  decryptedText: "Entschlüsselter Text",
  unknownSender: "Unbekannter Absender",
  authenticatedSender: "Authentifizierter Absender",
  sender: "Absender",
  contactStatus: "Kontaktstatus",
  knownSender: "Bekannter Kontakt",
  verifySenderGuidance:
    "Prüfe die kurze Identitäts-ID oder den Fingerabdruck über einen vertrauenswürdigen Kanal. Pseudonyme sind nicht eindeutig.",
  unknownSenderText:
    "Diese Nachricht ist kryptografisch gültig, aber du hast diesen Absender noch nicht gespeichert.",
  decryptFileTitle: "Datei entschlüsseln",
  encryptedFile: "Verschlüsselte Datei",
  decryptFileLocally: "Datei lokal entschlüsseln",
  decryptedFile: "Entschlüsselte Datei",
  filename: "Dateiname",
  caption: "Beschriftung",
  filePreview: "Geprüfte lokale Dateivorschau",
  previewAfterAuthentication:
    "Vorschau nur nach vollständiger Authentifizierung",
  previewUnavailable:
    "Keine sichere Vorschau ist verfügbar. Lade die geprüfte Datei herunter, um sie zu öffnen.",
  downloadDecryptedFile: "Entschlüsselte Datei herunterladen",
  unknownSenderFileText:
    "Diese Datei ist kryptografisch gültig, aber du hast diesen Absender noch nicht gespeichert.",
  saveSender: "Kontakt speichern",
  verifyFingerprintGuidance:
    "Prüfe diesen Fingerabdruck über einen vertrauenswürdigen Kanal, wenn die Echtheit wichtig ist.",
  diagnosticsTitle: "Lokale Diagnose",
  diagnosticsBody:
    "Erzeuge einen bereinigten Bericht auf diesem Gerät. Prüfe ihn vor dem Teilen.",
  generateDiagnostics: "Lokale Diagnose erzeugen",
  reportProblem: "Problem melden",
  viewSourceBuild: "Quellcode und Build-Infos anzeigen",
  sourceBuildInfo:
    "Statischer, lokal arbeitender Build. Quellrepository und signierte Release-Nachweise:",
  diagnosticsReview: "Diagnosebericht zur Prüfung",
  openIssueDraft: "Geprüften Issue-Entwurf öffnen",
  downloadIssueDraft: "Geprüften Issue-Entwurf herunterladen",
  issueTargetUnavailable:
    "Kein GitHub-Repository ist konfiguriert. Lade stattdessen den geprüften Entwurf herunter.",
  newerVersion: "Eine neuere Version ist verfügbar.",
  reviewLater: "Später ansehen",
  offlineState: "Du bist offline, aber diese Sitzung kann weiterarbeiten.",
  storageFallback:
    "Der dauerhafte Speicher ist nicht mehr verfügbar. Diese Sitzung läuft im Arbeitsspeicher weiter.",
  deletionNotConfirmed:
    "Der dauerhafte Speicher ist fehlgeschlagen. Die angeforderte Löschung konnte auf diesem Gerät nicht bestätigt werden.",
  aboutTitle: "Über",
  aboutClaim: "Verschlüsselt auf diesem Gerät. Kein Online-Konto.",
  noForwardSecrecy: "Version 1 hat kein Forward Secrecy.",
  namesAreLabels: "Namen sind nur Labels und nicht eindeutig.",
  contentNotMetadata: "Chat NoControl versteckt Inhalt, nicht Metadaten.",
  noPasswordReset: "Es gibt keine Passwortzurücksetzung.",
  identityLossWarning:
    "Wenn sowohl privates Identitätsmaterial als auch Wiederherstellungsmaterial verloren gehen, ist der Zugriff dauerhaft verloren.",
  exactSecurityClaim:
    "PPX v1 kombiniert Vertraulichkeit durch ML-KEM-512 und X25519 mit klassischer Ed25519-Absenderauthentifizierung.",
  securityNonclaims:
    "Kein Ratchet, kein Forward Secrecy, keine Sicherheit nach einer Kompromittierung, keine Behauptung geprüfter Identitäten, kein stabiles Release und kein Versprechen von Quantensicherheit, Signal-Gleichwertigkeit oder garantiertem sicherem Löschen.",
  readChatControlExplainer: "Dedizierten Chat-Control-Erklärtext lesen",
  privateSecurityReports:
    "Melde Sicherheits- oder Datenschutzlücken privat über GitHub Security Advisories, nicht als öffentliches Issue.",
  reportSecurityPrivately: "Sicherheitslücke privat melden",
  chatControlTitle: "Dedizierter Chat-Control-Erklärtext",
  chatControlBody:
    "Kinderschutz und private Kommunikation sind miteinander vereinbar. Dieses Projekt lehnt generalisierte Scans privater Kommunikation ab; es lehnt Kinderschutz nicht ab. Die App verschlüsselt nur lokal. Sie verbirgt keine Metadaten, bietet keine rechtliche Umgehung und ist kein Relay.",
};

export type MessageKey = keyof typeof en;
export type MessageParams<K extends MessageKey> = Partial<
  Record<string, string | number | bigint>
> & { readonly __messageKey?: K };
export interface I18nBundle {
  locale: Locale;
  t: <K extends MessageKey>(key: K, params?: MessageParams<K>) => string;
}
export const messages = { en, de } satisfies Record<
  Locale,
  Record<MessageKey, string>
>;

function interpolate(
  message: string,
  params: Partial<Record<string, string | number | bigint>> = {},
): string {
  return message.replace(
    /\{([A-Za-z][A-Za-z0-9_]*)\}/gu,
    (match, key: string) => (key in params ? String(params[key]) : match),
  );
}

export function translate<K extends MessageKey>(
  locale: Locale,
  key: K,
  params?: MessageParams<K>,
): string {
  return interpolate((messages[locale] ?? messages.en)[key], params);
}

export function createI18nBundle(locale: Locale): I18nBundle {
  return { locale, t: (key, params) => translate(locale, key, params) };
}

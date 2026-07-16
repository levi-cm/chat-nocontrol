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
  openSettings: "Open settings",
  settingsTitle: "Settings",
  settingsBody: "Choose how Chat NoControl looks on this device.",
  appearance: "Appearance",
  theme: "Theme",
  themeSystem: "System",
  themeLight: "Light",
  themeDark: "Dark",
  accentColor: "Accent color",
  accentBlue: "Blue",
  accentIndigo: "Indigo",
  accentPurple: "Purple",
  accentTeal: "Teal",
  accentPink: "Pink",
  accentOrange: "Orange",
  accentGraphite: "Graphite",
  translucentEffects: "Translucent interface effects",
  translucentEffectsHint:
    "Use subtle blur on navigation and elevated interface surfaces.",
  messageDeliverySettings: "Message delivery",
  messageOutputSetting: "Message output",
  messageOutputLink: "Link",
  messageOutputText: "Encrypted text",
  messageOutputBoth: "Both",
  autoDecryptIncomingMessages: "Auto-decrypt incoming message links and QRs",
  autoDecryptIncomingMessagesHint:
    "Decrypt locally after authentication. No message is saved by this setting.",
  messageQrSettings: "Message QR",
  messageQrCreationEnabled: "Offer message QR after text encryption",
  messageQrCreationEnabledHint:
    "Optional output after ordinary encrypted text. Receiving message QRs remains available.",
  qrExportSetting: "Export",
  qrExportApp: "In-app QR",
  qrExportLink: "Phone camera link",
  qrShowBoth: "Show both",
  qrImportSetting: "Import controls",
  qrImportCamera: "Camera",
  qrImportImage: "Screenshot or image",
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
  saveContactQr: "Save contact QR as PNG",
  showLargerQr: "Show larger QR",
  closeLargerQr: "Close larger QR",
  downloadContact: "Download public contact",
  publicContactHelper: "Share this contact so other people can encrypt to you.",
  publicContactHint: "Non-dangerous PPXC",
  publicBody: "Safe to share. Others use it to encrypt items for you.",
  privateLabel: "Private recovery card",
  privateAuthority: "Private secret",
  recoveryQrAlt: "Private recovery QR code",
  savePrivateQr: "Save private QR as PNG",
  vaultTitle: "Private identity vault",
  vaultWarning:
    "This vault is encrypted, but it still contains your private identity. Keep it private.",
  vaultQrAlt: "Encrypted private identity vault QR code",
  saveVaultQr: "Save private vault QR as PNG",
  downloadVault: "Download encrypted vault",
  vaultHint: "Encrypted PPXV",
  privateExportsLocked: "Private exports locked",
  privateExportPassphrase: "Re-enter vault passphrase",
  revealPrivateExports: "Reveal private exports",
  checkingPrivateExportPassword: "Checking password",
  privateExportPasswordError: "Password verification failed",
  privateBody: "Keep secret. Anyone who has it can recover your identity.",
  encryptTitle: "Encrypt",
  encryptBody: "Choose one contact, then encrypt text or one file locally.",
  decryptTitle: "Decrypt",
  decryptBody:
    "Paste encrypted text or choose an encrypted file. Validation happens before content appears.",
  incomingMessageTitle: "Open encrypted message",
  incomingIdentityRequired:
    "Unlock, import, or create the recipient identity to decrypt this message.",
  incomingMessageInvalid:
    "This encrypted message link is invalid, incomplete, or too large.",
  incomingMessageReady: "Encrypted message ready. Decrypt when you are ready.",
  notNow: "Not now",
  saveSeparateContact: "Save as separate contact",
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
  secureContextRequiredTitle: "Secure connection required",
  secureContextRequiredBody:
    "Open Chat NoControl through HTTPS or localhost. Plain HTTP cannot access the browser cryptography required to create or use an identity.",
  webCryptoUnavailableTitle: "Browser encryption unavailable",
  webCryptoUnavailableBody:
    "This browser does not provide the required Web Crypto API. Update it or use another current browser.",
  pseudonym: "Pseudonym",
  username: "Username",
  wizardStep: "Step {current} of 7",
  vaultPassword: "Browser-vault password",
  confirmVaultPassword: "Confirm browser-vault password",
  createEncryptedVault: "Create encrypted vault",
  weakVaultPasswordTitle: "Use a weak browser-vault password?",
  weakVaultPasswordBody:
    "This password is estimated as weak. It protects the encrypted browser copy. Choose a longer, less predictable password when possible.",
  changeVaultPassword: "Change password",
  useWeakVaultPassword: "Use weak password",
  vaultCreationErrorTitle: "Browser vault could not be created",
  vaultCreationErrorBody:
    "Nothing was saved. Your identity setup is still open. Try again or restart identity creation.",
  digitalBackupsTitle: "Save two digital recovery copies",
  digitalBackupsBody:
    "The private QR PNG, .ppxrecovery file, pasted recovery code, and 24 English words are four forms of the same login secret. Each restores the same identity. Never share them.",
  downloadRecoveryFile: "Download .ppxrecovery file",
  confirmQrStored: "I stored the private QR safely",
  confirmFileStored: "I stored the .ppxrecovery file safely",
  continueRecoveryWords: "Continue to recovery words",
  usernameHint:
    "People will see this username in their contacts. Do not use your real name or anything that can be traced back to you. Choose a made-up name instead.",
  usernameWarningTitle: "Public username, not a secret",
  usernameWarningText:
    "Other people can see this username. It is not unique and does not protect your identity.",
  passwordStepTitle: "Create your browser-vault password",
  passwordStepBody:
    "This password encrypts the copy remembered by this browser. Recovery QR, file, and words work without it. Use a unique password; it will be printed on your private recovery document.",
  restartIdentityCreation: "Restart identity creation",
  restartIdentityTitle: "Restart identity creation?",
  restartIdentityBody:
    "This destroys the unfinished identity and every recovery copy currently shown. Downloaded files are not deleted.",
  recoveryArtifactError: "Could not create this recovery document",
  recoveryDocumentTitle: "Write down or print your recovery words",
  recoveryDocumentBody:
    "These words, the private QR, and the .ppxrecovery file can all restore your identity. Anyone who gets them can decrypt as you.",
  downloadRecoveryPdf: "Download recovery PDF",
  confirmWordBackup: "Confirm all recovery backups",
  confirmWordsWritten: "I wrote down all 24 words",
  confirmPdfStored: "I safely stored the recovery PDF",
  continueRestorePractice: "Continue to restore practice",
  qrPracticeTitle: "Practice restoring with your private QR",
  qrPracticeBody:
    "If this browser is cleared, open Import identity and upload the saved QR, scan it with a camera, or paste the private recovery code.",
  privateRecoveryCode: "Private recovery code",
  verifyQrRecovery: "Verify private QR recovery",
  practiceRecoveryError:
    "This recovery copy is damaged or belongs to a different identity. Try again.",
  continueFilePractice: "Continue to file practice",
  fileWordPracticeTitle: "Practice file and recovery-word restore",
  filePracticeBody:
    "Choose the .ppxrecovery file you saved. The app will fully restore it locally and compare the identity.",
  verifyRecoveryFile: "Verify .ppxrecovery file",
  wordPracticeBody:
    "Now enter the four requested positions from your written or printed 24-word seed.",
  verifyRecoveryWords: "Verify four recovery words",
  wordPracticeError: "One or more recovery words are incorrect. Try again.",
  wordIncorrect: "This word is incorrect.",
  expertSkip: "I know what I’m doing",
  expertSkipTitle: "Skip restore practice?",
  expertSkipBody:
    "Your backups have not been proven. If they are missing or unreadable, losing browser access can permanently prevent decryption.",
  skipPractice: "Skip practice",
  continueStorageChoice: "Continue to storage choice",
  storageChoiceTitle: "Remember this identity on this device?",
  storageChoiceBody:
    "Recommended: remember an encrypted convenience copy in this browser.",
  storageRecoveryNote:
    "Your recovery QR, .ppxrecovery file, 24 words, PDF, or printout can restore the identity without the browser-vault password.",
  rememberRecommended: "Remember on this device (recommended)",
  rememberRecommendedBody:
    "Stores the encrypted vault in this browser’s IndexedDB. Your password is required to unlock it.",
  finishIdentitySetup: "Finish identity setup",
  passwordSurroundingSpace: "The password must not start or end with a space.",
  passwordPrintableAscii: "Use printable English-keyboard characters only.",
  passwordMismatch: "The two passwords do not match.",
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
  recoveryHint: "Dangerous PPXR",
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
  localDataTitle: "Local data",
  localDataBody:
    "Remove the encrypted browser vault or all local app data from this device.",
  storageUnavailable:
    "Storage is unavailable, so this session will not be remembered.",
  rememberDevice: "Yes, create an encrypted local vault",
  passphrase: "Vault passphrase",
  passphraseHint:
    "Any non-empty passphrase can be saved. Longer, uncommon passphrases are safer. Maximum 256 UTF-8 bytes.",
  passphraseError:
    "Enter at least one character and no more than 256 UTF-8 bytes.",
  estimatedBits: "Estimated strength: {bits} bits",
  passphraseWeak: "Weak",
  passphraseMedium: "Caution",
  passphraseStrong: "Strong",
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
  cameraInsecureContext:
    "Open the HTTPS URL to use the camera, or upload the saved QR image.",
  cameraPermissionDenied:
    "Camera permission was denied. Allow it in browser settings or upload the saved QR image.",
  cameraNotFound:
    "No camera was found. Connect a camera or upload the saved QR image.",
  cameraBusy:
    "The camera is busy in another app. Close it there or upload the saved QR image.",
  cameraUnavailable:
    "The camera could not start. Try again or upload the saved QR image.",
  qrScanError: "Could not read this QR image.",
  qrUnknownSender: "Import this sender's public contact first.",
  messageQrReady: "Encrypted message QR ready for local decryption.",
  importScannedQr: "Import scanned QR",
  paste: "Paste",
  pasteUnavailable: "Clipboard paste is unavailable in this browser context.",
  pasteFailed: "Could not read the clipboard. Paste into the field manually.",
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
  includeContactInMessageLink: "Include my public contact in link",
  includedContactLinkHint:
    "The recipient can authenticate you and choose whether to save your public contact.",
  compactLinkKnownContactHint:
    "The recipient must already have your public contact to authenticate and decrypt this compact link.",
  encryptedLink: "Encrypted link",
  messageLinkLength: "Link length",
  characters: "characters",
  longMessageLinkWarning:
    "This link is longer than 2,000 characters. Some messengers may collapse or truncate it; encrypted text remains the fallback.",
  copyEncryptedLink: "Copy encrypted link",
  shareEncryptedLink: "Share encrypted link",
  linkCopySucceeded:
    "Link copied. Clipboard clearing after 60 seconds is best effort.",
  linkCopySelected:
    "Automatic copy is unavailable. The complete link is selected; press Ctrl+C or use Copy.",
  linkCopyFailed:
    "Could not copy. Select the complete encrypted link manually.",
  preparingCompactLink: "Creating compact encrypted link...",
  compactLinkUnavailable:
    "Compact encrypted link could not be created. Include your public contact or use encrypted text instead.",
  switchContactInclusionOn: "Include my public contact",
  showEncryptedTextFallback: "Show encrypted text fallback",
  messageLinkUnavailable: "Encrypted link could not be created.",
  encryptedOutput: "Encrypted output",
  copyOutput: "Copy encrypted output",
  copySucceeded: "Copied. Clipboard clearing after 60 seconds is best effort.",
  copySelected:
    "Automatic copy is unavailable. The complete text is selected; press Ctrl+C or use Copy.",
  copyFailed: "Could not copy. Select the encrypted output manually.",
  saveOutput: "Save encrypted output",
  shareOutput: "Share encrypted output",
  qrKnownSenderGuidance:
    "The recipient must already have your public contact to verify and decrypt this compact QR.",
  downloadAppMessageQr: "Download in-app message QR",
  downloadLinkMessageQr: "Download phone camera link QR",
  messageQrTooLarge: "Encrypted QR is",
  messageQrTooLargeSuffix: "encoded bytes too large; shorten the message.",
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
  unsupportedCompression:
    "This compressed message needs a newer or supported browser. Update this browser or open it in another current browser.",
  technicalDetails: "Technical details",
  technicalFailureCode: "Validation failed before content release.",
  decryptedText: "Decrypted text",
  copyDecryptedText: "Copy decrypted text",
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
    "If you lose browser-vault access and every QR, .ppxrecovery, seed, PDF, and print recovery copy, the identity cannot be restored and its messages can never be decrypted again.",
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
  openSettings: "Einstellungen öffnen",
  settingsTitle: "Einstellungen",
  settingsBody: "Lege fest, wie Chat NoControl auf diesem Gerät aussieht.",
  appearance: "Darstellung",
  theme: "Farbschema",
  themeSystem: "System",
  themeLight: "Hell",
  themeDark: "Dunkel",
  accentColor: "Akzentfarbe",
  accentBlue: "Blau",
  accentIndigo: "Indigo",
  accentPurple: "Violett",
  accentTeal: "Türkis",
  accentPink: "Pink",
  accentOrange: "Orange",
  accentGraphite: "Graphit",
  translucentEffects: "Transparente Oberflächeneffekte",
  translucentEffectsHint:
    "Dezenten Weichzeichner für Navigation und erhöhte Oberflächen verwenden.",
  messageDeliverySettings: "Nachrichtenübermittlung",
  messageOutputSetting: "Nachrichtenausgabe",
  messageOutputLink: "Link",
  messageOutputText: "Verschlüsselter Text",
  messageOutputBoth: "Beides",
  autoDecryptIncomingMessages:
    "Eingehende Nachrichtenlinks und QRs automatisch entschlüsseln",
  autoDecryptIncomingMessagesHint:
    "Nach der Authentifizierung lokal entschlüsseln. Diese Einstellung speichert keine Nachricht.",
  messageQrSettings: "Nachrichten-QR",
  messageQrCreationEnabled: "Nachrichten-QR nach Textverschlüsselung anbieten",
  messageQrCreationEnabledHint:
    "Optionale Ausgabe nach normalem verschlüsseltem Text. Der Empfang von Nachrichten-QRs bleibt verfügbar.",
  qrExportSetting: "Export",
  qrExportApp: "In-App-QR",
  qrExportLink: "Link für die Handykamera",
  qrShowBoth: "Beides anzeigen",
  qrImportSetting: "Import-Steuerung",
  qrImportCamera: "Kamera",
  qrImportImage: "Screenshot oder Bild",
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
  saveContactQr: "Kontakt-QR als PNG speichern",
  showLargerQr: "QR-Code größer anzeigen",
  closeLargerQr: "Großen QR-Code schließen",
  downloadContact: "Öffentlichen Kontakt herunterladen",
  publicContactHelper:
    "Teile diesen Kontakt, damit andere dir verschlüsselt schreiben können.",
  publicContactHint: "Nicht gefährliches PPXC",
  publicBody:
    "Darf geteilt werden. Andere verschlüsseln damit Elemente für dich.",
  privateLabel: "Private Wiederherstellungskarte",
  privateAuthority: "Privates Geheimnis",
  recoveryQrAlt: "QR-Code der privaten Wiederherstellung",
  savePrivateQr: "Privaten QR-Code als PNG speichern",
  vaultTitle: "Privater Identitätstresor",
  vaultWarning:
    "Dieser Tresor ist verschlüsselt, enthält aber weiterhin deine private Identität. Halte ihn privat.",
  vaultQrAlt: "QR-Code des verschlüsselten privaten Identitätstresors",
  saveVaultQr: "QR des privaten Tresors als PNG speichern",
  downloadVault: "Verschlüsselten Tresor herunterladen",
  vaultHint: "Verschlüsseltes PPXV",
  privateExportsLocked: "Private Exporte gesperrt",
  privateExportPassphrase: "Tresor-Passwort erneut eingeben",
  revealPrivateExports: "Private Exporte anzeigen",
  checkingPrivateExportPassword: "Passwort wird geprüft",
  privateExportPasswordError: "Passwortprüfung fehlgeschlagen",
  privateBody:
    "Geheim halten. Wer sie besitzt, kann deine Identität wiederherstellen.",
  encryptTitle: "Verschlüsseln",
  encryptBody:
    "Wähle einen Kontakt und verschlüssele Text oder eine Datei lokal.",
  decryptTitle: "Entschlüsseln",
  decryptBody:
    "Füge verschlüsselten Text ein oder wähle eine verschlüsselte Datei. Inhalte erscheinen erst nach der Prüfung.",
  incomingMessageTitle: "Verschlüsselte Nachricht öffnen",
  incomingIdentityRequired:
    "Entsperre, importiere oder erstelle die Empfängeridentität, um diese Nachricht zu entschlüsseln.",
  incomingMessageInvalid:
    "Dieser verschlüsselte Nachrichtenlink ist ungültig, unvollständig oder zu groß.",
  incomingMessageReady:
    "Verschlüsselte Nachricht bereit. Entschlüssle sie, wenn du bereit bist.",
  notNow: "Nicht jetzt",
  saveSeparateContact: "Als separaten Kontakt speichern",
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
  secureContextRequiredTitle: "Sichere Verbindung erforderlich",
  secureContextRequiredBody:
    "Öffne Chat NoControl über HTTPS oder localhost. Über einfaches HTTP kann die erforderliche Browser-Verschlüsselung nicht verwendet werden.",
  webCryptoUnavailableTitle: "Browser-Verschlüsselung nicht verfügbar",
  webCryptoUnavailableBody:
    "Dieser Browser stellt die erforderliche Web-Crypto-API nicht bereit. Aktualisiere ihn oder verwende einen anderen aktuellen Browser.",
  pseudonym: "Pseudonym",
  username: "Benutzername",
  wizardStep: "Schritt {current} von 7",
  vaultPassword: "Browser-Tresor-Passwort",
  confirmVaultPassword: "Browser-Tresor-Passwort bestätigen",
  createEncryptedVault: "Verschlüsselten Tresor erstellen",
  weakVaultPasswordTitle: "Schwaches Browser-Tresor-Passwort verwenden?",
  weakVaultPasswordBody:
    "Dieses Passwort wird als schwach eingeschätzt. Es schützt die verschlüsselte Browser-Kopie. Verwende möglichst ein längeres, weniger vorhersehbares Passwort.",
  changeVaultPassword: "Passwort ändern",
  useWeakVaultPassword: "Schwaches Passwort verwenden",
  vaultCreationErrorTitle: "Browser-Tresor konnte nicht erstellt werden",
  vaultCreationErrorBody:
    "Es wurde nichts gespeichert. Deine Identitätseinrichtung bleibt geöffnet. Versuche es erneut oder starte die Identitätserstellung neu.",
  digitalBackupsTitle: "Zwei digitale Wiederherstellungskopien speichern",
  digitalBackupsBody:
    "Privates QR-PNG, .ppxrecovery-Datei, eingefügter Wiederherstellungscode und 24 englische Wörter sind vier Formen desselben Anmeldegeheimnisses. Jede stellt dieselbe Identität wieder her. Teile sie niemals.",
  downloadRecoveryFile: ".ppxrecovery-Datei herunterladen",
  confirmQrStored: "Ich habe den privaten QR-Code sicher gespeichert",
  confirmFileStored: "Ich habe die .ppxrecovery-Datei sicher gespeichert",
  continueRecoveryWords: "Weiter zu den Wiederherstellungswörtern",
  usernameHint:
    "Andere Personen sehen diesen Benutzernamen in ihren Kontakten. Verwende nicht deinen echten Namen oder etwas, das zu dir zurückverfolgt werden kann. Wähle stattdessen einen erfundenen Namen.",
  usernameWarningTitle: "Öffentlicher Benutzername, kein Geheimnis",
  usernameWarningText:
    "Andere können diesen Benutzernamen sehen. Er ist nicht eindeutig und schützt deine Identität nicht.",
  passwordStepTitle: "Browser-Tresor-Passwort erstellen",
  passwordStepBody:
    "Dieses Passwort verschlüsselt die in diesem Browser gemerkte Kopie. Wiederherstellungs-QR, Datei und Wörter funktionieren ohne das Passwort. Verwende ein einzigartiges Passwort; es wird auf dein privates Wiederherstellungsdokument gedruckt.",
  restartIdentityCreation: "Identitätserstellung neu starten",
  restartIdentityTitle: "Identitätserstellung neu starten?",
  restartIdentityBody:
    "Dadurch werden die unfertige Identität und alle momentan angezeigten Wiederherstellungskopien vernichtet. Heruntergeladene Dateien werden nicht gelöscht.",
  recoveryArtifactError:
    "Dieses Wiederherstellungsdokument konnte nicht erstellt werden",
  recoveryDocumentTitle: "Wiederherstellungswörter aufschreiben oder drucken",
  recoveryDocumentBody:
    "Diese Wörter, der private QR-Code und die .ppxrecovery-Datei können alle deine Identität wiederherstellen. Wer sie erhält, kann als du entschlüsseln.",
  downloadRecoveryPdf: "Wiederherstellungs-PDF herunterladen",
  confirmWordBackup: "Alle Wiederherstellungssicherungen bestätigen",
  confirmWordsWritten: "Ich habe alle 24 Wörter aufgeschrieben",
  confirmPdfStored: "Ich habe das Wiederherstellungs-PDF sicher verwahrt",
  continueRestorePractice: "Weiter zur Wiederherstellungsübung",
  qrPracticeTitle: "Wiederherstellung mit dem privaten QR-Code üben",
  qrPracticeBody:
    "Wenn dieser Browser gelöscht wird, öffne Identität importieren und lade den gespeicherten QR-Code hoch, scanne ihn mit einer Kamera oder füge den privaten Wiederherstellungscode ein.",
  privateRecoveryCode: "Privater Wiederherstellungscode",
  verifyQrRecovery: "Private QR-Wiederherstellung prüfen",
  practiceRecoveryError:
    "Diese Wiederherstellungskopie ist beschädigt oder gehört zu einer anderen Identität. Versuche es erneut.",
  continueFilePractice: "Weiter zur Dateiübung",
  fileWordPracticeTitle: "Datei- und Wörterwiederherstellung üben",
  filePracticeBody:
    "Wähle die gespeicherte .ppxrecovery-Datei. Die App stellt sie vollständig lokal wieder her und vergleicht die Identität.",
  verifyRecoveryFile: ".ppxrecovery-Datei prüfen",
  wordPracticeBody:
    "Gib jetzt die vier verlangten Positionen aus deinem aufgeschriebenen oder gedruckten 24-Wörter-Seed ein.",
  verifyRecoveryWords: "Vier Wiederherstellungswörter prüfen",
  wordPracticeError:
    "Mindestens ein Wiederherstellungswort ist falsch. Versuche es erneut.",
  wordIncorrect: "Dieses Wort ist falsch.",
  expertSkip: "Ich weiß, was ich tue",
  expertSkipTitle: "Wiederherstellungsübung überspringen?",
  expertSkipBody:
    "Deine Sicherungen wurden nicht geprüft. Wenn sie fehlen oder unlesbar sind, kann der Verlust des Browserzugriffs die Entschlüsselung dauerhaft verhindern.",
  skipPractice: "Übung überspringen",
  continueStorageChoice: "Weiter zur Speicherwahl",
  storageChoiceTitle: "Diese Identität auf diesem Gerät merken?",
  storageChoiceBody:
    "Empfohlen: Merke eine verschlüsselte Komfortkopie in diesem Browser.",
  storageRecoveryNote:
    "Wiederherstellungs-QR, .ppxrecovery-Datei, 24 Wörter, PDF oder Ausdruck können die Identität ohne das Browser-Tresor-Passwort wiederherstellen.",
  rememberRecommended: "Auf diesem Gerät merken (empfohlen)",
  rememberRecommendedBody:
    "Speichert den verschlüsselten Tresor im IndexedDB dieses Browsers. Zum Entsperren wird dein Passwort benötigt.",
  finishIdentitySetup: "Identitätseinrichtung abschließen",
  passwordSurroundingSpace:
    "Das Passwort darf nicht mit einem Leerzeichen beginnen oder enden.",
  passwordPrintableAscii:
    "Verwende nur druckbare Zeichen einer englischen Tastatur.",
  passwordMismatch: "Die beiden Passwörter stimmen nicht überein.",
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
  recoveryHint: "Gefährliches PPXR",
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
  localDataTitle: "Lokale Daten",
  localDataBody:
    "Entferne den verschlüsselten Browser-Tresor oder alle lokalen App-Daten von diesem Gerät.",
  storageUnavailable:
    "Speicher ist nicht verfügbar, deshalb wird sich diese Sitzung nicht merken.",
  rememberDevice: "Ja, verschlüsselten lokalen Tresor erstellen",
  passphrase: "Tresor-Passphrase",
  passphraseHint:
    "Jede nicht leere Passphrase kann gespeichert werden. Längere, ungewöhnliche Passphrasen sind sicherer. Höchstens 256 UTF-8-Bytes.",
  passphraseError:
    "Gib mindestens ein Zeichen und höchstens 256 UTF-8-Bytes ein.",
  estimatedBits: "Geschätzte Stärke: {bits} Bit",
  passphraseWeak: "Schwach",
  passphraseMedium: "Vorsicht",
  passphraseStrong: "Stark",
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
  cameraInsecureContext:
    "Öffne die HTTPS-URL für die Kamera oder lade das gespeicherte QR-Bild hoch.",
  cameraPermissionDenied:
    "Der Kamerazugriff wurde abgelehnt. Erlaube ihn in den Browser-Einstellungen oder lade das gespeicherte QR-Bild hoch.",
  cameraNotFound:
    "Keine Kamera gefunden. Schließe eine Kamera an oder lade das gespeicherte QR-Bild hoch.",
  cameraBusy:
    "Die Kamera wird von einer anderen App verwendet. Schließe sie dort oder lade das gespeicherte QR-Bild hoch.",
  cameraUnavailable:
    "Die Kamera konnte nicht gestartet werden. Versuche es erneut oder lade das gespeicherte QR-Bild hoch.",
  qrScanError: "Dieses QR-Bild konnte nicht gelesen werden.",
  qrUnknownSender:
    "Importiere zuerst den öffentlichen Kontakt dieses Absenders.",
  messageQrReady:
    "Der verschlüsselte Nachrichten-QR ist zur lokalen Entschlüsselung bereit.",
  importScannedQr: "Gescannten QR-Code importieren",
  paste: "Einfügen",
  pasteUnavailable:
    "Das Einfügen aus der Zwischenablage ist in diesem Browser-Kontext nicht verfügbar.",
  pasteFailed:
    "Die Zwischenablage konnte nicht gelesen werden. Füge den Inhalt manuell in das Feld ein.",
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
  includeContactInMessageLink: "Meinen öffentlichen Kontakt im Link mitsenden",
  includedContactLinkHint:
    "Der Empfänger kann dich authentifizieren und selbst entscheiden, ob dein öffentlicher Kontakt gespeichert wird.",
  compactLinkKnownContactHint:
    "Der Empfänger muss deinen öffentlichen Kontakt bereits besitzen, um diesen kompakten Link zu authentifizieren und zu entschlüsseln.",
  encryptedLink: "Verschlüsselter Link",
  messageLinkLength: "Linklänge",
  characters: "Zeichen",
  longMessageLinkWarning:
    "Dieser Link ist länger als 2.000 Zeichen. Manche Messenger kürzen oder verbergen ihn; verschlüsselter Text bleibt die Ausweichmöglichkeit.",
  copyEncryptedLink: "Verschlüsselten Link kopieren",
  shareEncryptedLink: "Verschlüsselten Link teilen",
  linkCopySucceeded:
    "Link kopiert. Das Löschen der Zwischenablage nach 60 Sekunden ist nur ein bestmöglicher Versuch.",
  linkCopySelected:
    "Automatisches Kopieren ist nicht verfügbar. Der vollständige Link ist ausgewählt; drücke Strg+C oder verwende Kopieren.",
  linkCopyFailed:
    "Kopieren nicht möglich. Wähle den vollständigen verschlüsselten Link manuell aus.",
  preparingCompactLink: "Kompakter verschlüsselter Link wird erstellt...",
  compactLinkUnavailable:
    "Der kompakte verschlüsselte Link konnte nicht erstellt werden. Sende deinen öffentlichen Kontakt mit oder verwende verschlüsselten Text.",
  switchContactInclusionOn: "Meinen öffentlichen Kontakt mitsenden",
  showEncryptedTextFallback:
    "Verschlüsselten Text als Ausweichmöglichkeit anzeigen",
  messageLinkUnavailable:
    "Der verschlüsselte Link konnte nicht erstellt werden.",
  encryptedOutput: "Verschlüsselte Ausgabe",
  copyOutput: "Verschlüsselte Ausgabe kopieren",
  copySucceeded:
    "Kopiert. Das Löschen der Zwischenablage nach 60 Sekunden ist nur ein bestmöglicher Versuch.",
  copySelected:
    "Automatisches Kopieren ist nicht verfügbar. Der vollständige Text ist ausgewählt; drücke Strg+C oder verwende Kopieren.",
  copyFailed:
    "Kopieren nicht möglich. Wähle die verschlüsselte Ausgabe manuell aus.",
  saveOutput: "Verschlüsselte Ausgabe speichern",
  shareOutput: "Verschlüsselte Ausgabe teilen",
  qrKnownSenderGuidance:
    "Der Empfänger muss deinen öffentlichen Kontakt bereits besitzen, um diesen kompakten QR zu prüfen und zu entschlüsseln.",
  downloadAppMessageQr: "In-App-Nachrichten-QR herunterladen",
  downloadLinkMessageQr: "QR-Link für die Handykamera herunterladen",
  messageQrTooLarge: "Der verschlüsselte QR ist",
  messageQrTooLargeSuffix: "kodierte Bytes zu groß; kürze die Nachricht.",
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
  unsupportedCompression:
    "Diese komprimierte Nachricht benötigt einen neueren oder unterstützten Browser. Aktualisiere diesen Browser oder öffne sie in einem anderen aktuellen Browser.",
  technicalDetails: "Technische Details",
  technicalFailureCode:
    "Die Prüfung ist fehlgeschlagen, bevor Inhalte freigegeben wurden.",
  decryptedText: "Entschlüsselter Text",
  copyDecryptedText: "Entschlüsselten Text kopieren",
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
    "Wenn du den Browser-Tresor und alle QR-, .ppxrecovery-, Seed-, PDF- und Ausdruck-Kopien verlierst, kann die Identität nicht wiederhergestellt und ihre Nachrichten können nie wieder entschlüsselt werden.",
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

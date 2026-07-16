> **Authority:** Chat NoControl documentation authority; this file normatively defines the end-user English guide for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta channel / stable release unavailable / operational status is external
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [accessibility-i18n.md](accessibility-i18n.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# User Guide: English

## 1. What this is

Chat NoControl is a local browser app for creating a private identity, sharing a public contact, and encrypting or decrypting text and files without creating an online account.

It runs in your browser. It does not need a server for normal use.

## 2. Before you start

- Pick a username you are comfortable showing other people. The app stores it as the PPX `pseudonym`; it is public and not unique.
- If you use 24 recovery words, know that they are English-only and restore the same cryptographic identity without restoring the original pseudonym or creation time.
- Have a browser with current JavaScript and file support.
- Create a browser-vault password that you do not use elsewhere. It must use printable ASCII, may contain internal spaces, must not start or end with a space, and may be at most 256 bytes.
- Plan to save both a private QR PNG and `.ppxrecovery` file, handwrite all 24 words, and download and safely store the recovery PDF.

## 3. Create or import an identity

1. Open the app.
2. On the first screen, choose `Create new identity` or `Import identity`.
3. For a new identity, complete the seven labeled screens:
   1. Enter a public `Username` and generate the identity.
   2. Enter and confirm the browser-vault password. The password protects only the encrypted browser copy; QR, recovery-file, and word recovery do not require it.
   3. Download both the private QR PNG and `.ppxrecovery` file and confirm that each is stored safely.
   4. Write down all 24 English words and use the single Download action for the private A4 recovery PDF. Confirm both backups separately: written words and safely stored PDF. The PDF confirmation stays unavailable until download, and either missing confirmation blocks continuation. Desktop shows the exact generated PDF inline; small screens hide the preview but keep the words and a full-width Download action. The sheet contains your username, dates, QR, full recovery code, words, and exact plaintext browser-vault password. Never share it or reuse that password.
   5. Practice the cleared-browser import path by scanning/uploading the saved QR or pasting the recovery code.
   6. Import the saved `.ppxrecovery`, then enter the four requested random word positions. Wrong answers can be retried without limit; after ten failed submissions the app also offers a confirmed restart.
   7. Confirm whether to remember the encrypted vault. `Remember on this device` is recommended and preselected, but the app writes to IndexedDB only after you continue. Choose `Session only` to opt out.
4. The quiet `I know what I'm doing` action can skip only the two practice screens. It cannot skip downloads or backup confirmations.
5. After the recovery-document screen, Back cannot show the password, words, recovery code, QR, or document again. Restart if you did not preserve them correctly.
6. If you are importing an existing identity, choose one source: a locked `PPXV` vault, an unencrypted `PPXR` recovery card or `PPXR` QR image, or `24 recovery words`.
7. If you chose `24 recovery words`, enter all 24 English words exactly as written.
8. If you chose `PPXR`, read the warning first because the material is unencrypted.
9. If you chose `PPXV`, enter the vault passphrase.
10. Let the app validate the material, derive the identity, and verify that it matches.
11. If you used recovery words, choose or re-enter a pseudonym before continuing. It may be different from the original, but the cryptographic identity fingerprint stays the same.
12. The app creates a signed public contact for that fingerprint. `PPXV` and `PPXR` preserve their embedded pseudonym and creation time; word import uses the new pseudonym and records only a new local import time.

What the choices mean:

- `Remember on this device` keeps only an encrypted identity vault in local IndexedDB after explicit confirmation.
- `Session only` keeps nothing after you close the app or the session ends.
- The private QR, `.ppxrecovery`, recovery code, 24 words, and recovery sheet are different forms of the same identity-recovery authority. Anyone who gets one can recover your private identity.
- The recovery-sheet password is separate: it unlocks the encrypted browser vault, but is not needed for QR, `.ppxrecovery`, or word recovery.
- If you lose every recovery copy and access to the remembered browser vault, the identity and messages encrypted for it can never be recovered.
- Public contact import stays in `Contacts`.
- The live password-strength estimate is guidance, not a security guarantee.

## 4. Share your public contact

1. Open `Identity`.
2. Find your `Public contact`.
3. Share that contact by QR or file. Choose `Save contact QR as PNG` when you need an image.
4. Tell the other person to verify the public fingerprint through a trusted channel if they need authenticity.

The public contact is safe to share. It is meant for other people to encrypt to you.

The logged-in encrypted private-vault QR starts hidden. Re-enter the browser-vault password once to reveal it; the same successful check enables `Save private vault QR as PNG` and the `.ppxvault` identity-file download until you leave Identity, lock the app, or put the app in the background. Keep both files private. Onboarding recovery downloads do not add this second prompt.

### Settings, delivery, and appearance

Open the gear button in the top bar to change language, theme, accent color, or translucent interface effects. Theme options are `System`, `Light`, and `Dark`. Turning translucent effects off replaces blurred navigation material with opaque surfaces.

`Message output` controls text-message delivery:

- `Link` shows the encrypted link.
- `Text` shows ordinary encrypted PPXT armor.
- `Both`, the default, shows the link first and PPXT armor as a fallback.

`Auto-decrypt incoming message links and QRs` is on by default. Turn it off if
you want an incoming item populated for an explicit `Decrypt` action instead.
This replaces the older QR-only auto-decrypt preference.

## 5. Add contacts

1. Open `Contacts`.
2. Import a public contact by QR, QR image, or file.
3. Optionally add a local nickname.
4. Open the contact details.
5. Choose `Delete contact` and confirm if you want to remove it.
6. This removes only the local public contact and nickname. It does not delete external files or your identity.
7. You can import the same contact again later.
8. Search by pseudonym, nickname, or fingerprint detail.

Useful notes:

- Importing the same key again merges the entry.
- If two contacts share a pseudonym but have different keys, keep both until you know which one is correct.
- Contacts usually persist on this device unless you are in session-only mode.

## 6. Encrypt text

1. Open `Encrypt`.
2. Select one recipient.
3. Paste or type up to `256 KiB` in `Encrypted text`.
4. If your output includes a link, leave `Include my public contact in link` on
   unless the recipient already has your exact public contact. This preference
   is stored separately for each recipient and defaults on until you switch it
   off.
5. Choose `Encrypt`.
6. Use `Copy encrypted link`, or `Share encrypted link` when your platform
   offers Web Share. Sharing sends the URL only. Browser and share-target support
   is best effort, so copying remains available. In `Text` mode, copy or save the
   ordinary encrypted output instead.

With contact inclusion on, the link contains self-contained encrypted PPXT. With
it off, the shorter PPXQ link requires the recipient to already have your exact
sender contact. If compact PPXQ cannot be created, switch contact inclusion on
or reveal the ordinary encrypted-text fallback. The app shows the exact link
length. Links over 2,000 characters remain copyable, but messengers may collapse,
truncate, or fail to linkify them.

Message-QR creation remains off by default. If you deliberately enable `Offer
message QR after text encryption` in Settings, a compact message that fits one
high-recovery QR may additionally offer an in-app QR and/or phone-camera link.
No preview is shown. The recipient must already have your public contact for
compact PPXQ. Emoji, skin tones, flags, combining marks, and joined emoji are
ordinary UTF-8 message content and count toward the 256 KiB byte limit.

Tips:

- The app encrypts locally.
- One output is for one recipient.
- Use the contact search box if you have many contacts.
- Text compression is automatic and content-agnostic. Repetitive long text may
  become much smaller; short or already compact text stays in the compatible
  uncompressed format. There is no compression setting.

## 7. Encrypt a file

1. Open `Encrypt`.
2. Select one recipient.
3. Under `Encrypt a file`, pick one file up to `100 MiB`.
4. Optionally add a caption up to `16 KiB`.
5. Choose `Encrypt file locally`.
6. The completed `.ppxfile` download starts only after encryption finishes.

Notes:

- If the process is interrupted, file encryption restarts from the beginning.
- `Cancel file operation` discards partial output.
- The app may preview supported image, audio, and video types only after full authentication.
- Documents and unsupported media are offered as safe downloads only.

## 8. Decrypt text or file

1. Open `Decrypt`.
2. For text, paste armor or an encrypted message link into `Encrypted item` and
   choose `Decrypt locally`. You can also open an encrypted link, scan a message
   QR, or choose a screenshot/image. Valid links and message QRs decrypt
   immediately by default; turn off automatic incoming decryption in Settings
   if you want an explicit confirmation. Pasting a link reads its fragment
   without navigating to its host. Receiving remains available when message-QR
   creation is disabled.
3. For a file, select a `.ppxfile` under `Decrypt a file` and choose `Decrypt file locally`.
4. If validation succeeds, read the plaintext or inspect and download the file result.
5. If the sender is unknown, you will see a warning.
6. If the item does not match your active identity, the app will fail safely.

Encrypted links keep all ciphertext after `#`. The app scrubs valid and malformed
reserved fragments from the address before normal initialization and keeps only
a parsed pending item in memory for at most 15 minutes. It does not send the
fragment in an HTTP request or use a relay server. A remembered locked vault asks
for its password on the incoming-message path and then continues decryption. If
no active or remembered identity exists, import the correct identity; the pending
item continues after a successful import. Canceling or replacing the item clears
the old pending intent.

Self-contained PPXT can authenticate an unknown sender after decryption. Choose
`Save contact` or `Not now`. An exact fingerprint already in contacts creates no
duplicate. If the same pseudonym belongs to a different fingerprint, the app
warns before writing and requires `Save as separate contact`. Compact PPXQ from
an unknown fingerprint fails closed and asks for sender-contact import. Camera
failure always leaves image upload.

Updated browsers open both uncompressed PPXT v1 and compressed PPXT v2. If a
valid compressed message reaches a browser without gzip support, update the
browser or open it in another current supported browser.

What to expect:

- Safe failures are normal and do not reveal extra detail by default.
- You can open technical details if you need them.
- Messages from unknown senders can still be decrypted if they are cryptographically valid.
- You may save the sender as a contact after decryption.

## 9. Lock, delete, and session-only mode

1. Open `Identity`.
2. Use `Lock now` when you are done.
3. Use `Delete vault` if you want to remove remembered private identity data.
4. Use `Erase everything` only when you truly want to remove all local data.

Unlocking a remembered vault returns to the last unlocked page stored by this browser. A pending inbound QR goes to `Decrypt` first, and an invalid or missing remembered page falls back to `Encrypt`. Creating a new identity still routes to `Encrypt`. Deleting the vault or erasing all local data also clears the remembered page.

About session-only mode:

- It is the fallback when storage is unavailable.
- Nothing is meant to stay after the session ends.
- Contacts and identity data are not persisted in this mode.

## 10. Offline use and updates

- After the app has loaded successfully once, it may keep working offline if your browser keeps the app shell and assets.
- New versions activate silently in the background without interrupting the open page.
- Reload the page or fully reopen the app when you want to use the newest activated version. Do not reload in the middle of encryption, decryption, or an open decrypted result.

## 11. Troubleshooting

If something fails:

- Check whether you selected the correct recipient.
- Check whether the file or pasted text is complete.
- Check whether storage is available if you expected persistence.
- Check whether the sender is already in your contacts.
- Open the printed HTTPS development URL for camera scanning. Plain IP HTTP cannot request camera access; screenshot/image import remains available.
- If automatic copy is unavailable, the app selects the complete text. Use the browser's Copy command; it does not claim that copying succeeded.
- Use the technical details expander only if you need extra information.

Common safe messages:

- `This item does not match your active identity or is damaged.`
- `The item decrypted, but the sender check failed.`
- `Storage is unavailable, so this session will not be remembered.`

## 12. Security limits

- Chat NoControl hides content, not metadata.
- It does not provide forward secrecy in v1.
- It does not create an account.
- It does not offer password reset.
- It does not guarantee secure deletion of browser memory.
- It does not protect you from a compromised device, browser extension, or malware.
- The private recovery card and any encrypted vault must be kept safe.
- The 24 recovery words are private-equivalent recovery material and must be kept safe.
- Encrypted links may remain in messenger history, clipboard history, browser
  history sync, or crash recovery. Their length and compressibility leak coarse
  metadata, and screenshots can capture them.
- A fragment is not sent in the HTTP request, but the complete URL exists before
  the app's JavaScript scrubs it. A compromised deployment, browser, extension,
  or device can still read it.
- Message links may be replayed. The app stores no message IDs and provides no
  forward secrecy, ratchet, or cross-session replay protection.
- Browsers and operating systems decide whether a link opens an installed PWA.
  Browser fallback and in-app paste remain supported.

## 13. Getting help

Open `Help` or `About` to read:

- The plain-language security limits.
- The source and build information.
- The dedicated chat-control explainer links.
- The local issue reporting path.

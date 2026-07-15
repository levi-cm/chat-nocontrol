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
- Plan to save both a private QR PNG and `.ppxrecovery` file, and to handwrite the words, print the recovery sheet, or save its PDF.

## 3. Create or import an identity

1. Open the app.
2. On the first screen, choose `Create new identity` or `Import identity`.
3. For a new identity, complete the seven labeled screens:
   1. Enter a public `Username` and generate the identity.
   2. Enter and confirm the browser-vault password. The password protects only the encrypted browser copy; QR, recovery-file, and word recovery do not require it.
   3. Download both the private QR PNG and `.ppxrecovery` file and confirm that each is stored safely.
   4. Write down all 24 English words, open the print action, and download the private A4 recovery PDF. Confirm all three backups separately; one or two confirmations cannot continue. Desktop shows the exact generated PDF inline, while small screens keep the words and actions without squeezing the preview. The sheet contains your username, dates, QR, full recovery code, words, and exact plaintext browser-vault password. Never share it or reuse that password.
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

### Settings and appearance

Open the gear button in the top bar to change language, theme, accent color, or translucent interface effects. Theme options are `System`, `Light`, and `Dark`. Turning translucent effects off replaces blurred navigation material with opaque surfaces.

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
4. Choose `Encrypt locally`.
5. Copy or save the encrypted output.

Ordinary PPXT is always the primary output. Message-QR creation is off by
default. If you deliberately enable `Offer message QR after text encryption`
in Settings, a compact message that fits one high-recovery QR may additionally
offer an in-app QR and/or phone-camera link. No preview is shown. If it does not
fit, use the normal PPXT output. The recipient must already have your public
contact.

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
2. For text, paste armor into `Encrypted item` and choose `Decrypt locally`.
   You can also scan a message QR or choose a screenshot/image. Valid message
   QRs decrypt immediately by default; disable that only in local settings.
   Receiving remains available even when message-QR creation is disabled.
3. For a file, select a `.ppxfile` under `Decrypt a file` and choose `Decrypt file locally`.
4. If validation succeeds, read the plaintext or inspect and download the file result.
5. If the sender is unknown, you will see a warning.
6. If the item does not match your active identity, the app will fail safely.

Phone-camera links keep ciphertext after `#`, scrub it from the address
immediately, and never store pending messages. Unknown-sender QRs require that
sender's public contact first. Camera failure always leaves image upload.

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
- If a newer version is deployed, you will see an update message.
- Do not reload in the middle of encryption, decryption, or an open decrypted result.

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
- `A newer version is available.`

## 12. Security limits

- Chat NoControl hides content, not metadata.
- It does not provide forward secrecy in v1.
- It does not create an account.
- It does not offer password reset.
- It does not guarantee secure deletion of browser memory.
- It does not protect you from a compromised device, browser extension, or malware.
- The private recovery card and any encrypted vault must be kept safe.
- The 24 recovery words are private-equivalent recovery material and must be kept safe.

## 13. Getting help

Open `Help` or `About` to read:

- The plain-language security limits.
- The source and build information.
- The dedicated chat-control explainer links.
- The local issue reporting path.

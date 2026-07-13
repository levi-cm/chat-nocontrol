> **Authority:** Chat NoControl documentation authority; this file normatively defines the end-user English guide for Chat NoControl v1.
> **Version:** 1.0-draft
> **Status:** Public beta candidate / unaudited / not deployed
> **Depends on:** [../Chat_NoControl_full_plan.md](../Chat_NoControl_full_plan.md), [protocol-v1.md](protocol-v1.md), [security-architecture.md](security-architecture.md), [threat-model.md](threat-model.md), [product-spec.md](product-spec.md), [design-spec.md](design-spec.md), [ux-content-spec.md](ux-content-spec.md), [accessibility-i18n.md](accessibility-i18n.md), [user-guide.de.md](user-guide.de.md), [testing-and-release.md](testing-and-release.md), [references.md](references.md)
> **Supersedes:** The original WebLibre plan is historical only; see [../WebLibre_full_plan.md](../WebLibre_full_plan.md) for archive context, not as an active specification.

# User Guide: English

## 1. What this is

Chat NoControl is a local browser app for creating a private identity, sharing a public contact, and encrypting or decrypting text and files without creating an online account.

It runs in your browser. It does not need a server for normal use.

## 2. Before you start

- Pick a pseudonym you are comfortable showing other people.
- Remember that the pseudonym is public and not unique.
- If you use 24 recovery words, know that they are English-only and restore the same cryptographic identity without restoring the original pseudonym or creation time.
- Have a browser with current JavaScript and file support.
- If you want the app to remember your identity, decide whether to store an encrypted local vault.
- Plan to export the private recovery card before you finish identity setup.

## 3. Create or import an identity

1. Open the app.
2. On the first screen, choose `Create new identity` or `Import identity`.
3. If you are creating a new identity, enter a pseudonym, read the warning that the pseudonym is public and not a secret, and choose `Generate identity`.
4. Export the private recovery card when prompted. The app will also ask you to confirm a few randomly selected recovery-word positions.
5. If you are using keyboard or switch access, focus the export action, activate it, type `EXPORT PRIVATE` when asked, and confirm.
6. If you are importing an identity, choose one source: a locked `PPXV` vault, an unencrypted `PPXR` recovery card or `PPXR` QR image, or `24 recovery words`.
7. If you chose `24 recovery words`, enter all 24 English words exactly as written.
8. If you chose `PPXR`, read the warning first because the material is unencrypted.
9. If you chose `PPXV`, enter the vault passphrase.
10. Let the app validate the material, derive the identity, and verify that it matches.
11. If you used recovery words, choose or re-enter a pseudonym before continuing. It may be different from the original, but the cryptographic identity fingerprint stays the same.
12. The app creates a signed public contact for that fingerprint. `PPXV` and `PPXR` preserve their embedded pseudonym and creation time; word import uses the new pseudonym and records only a new local import time.
13. After import or creation, choose whether to remember this identity on this device.

What the choices mean:

- `Encrypted local vault` keeps your identity on this device behind a passphrase.
- `Session only` keeps nothing after you close the app or the session ends.
- The private recovery card is dangerous. Anyone who gets it can recover your private identity.
- The 24 recovery words are just as sensitive as the private recovery card. Never share them.
- Public contact import stays in `Contacts`.

## 4. Share your public contact

1. Open `Identity`.
2. Find your `Public contact`.
3. Share that contact by QR or file.
4. Tell the other person to verify the public fingerprint through a trusted channel if they need authenticity.

The public contact is safe to share. It is meant for other people to encrypt to you.

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

Tips:

- The app encrypts locally.
- One output is for one recipient.
- Use the contact search box if you have many contacts.

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
3. For a file, select a `.ppxfile` under `Decrypt a file` and choose `Decrypt file locally`.
4. If validation succeeds, read the plaintext or inspect and download the file result.
5. If the sender is unknown, you will see a warning.
6. If the item does not match your active identity, the app will fail safely.

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

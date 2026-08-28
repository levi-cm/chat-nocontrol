> **Authority:** User guide for target `0.2.0-beta.1`.
> **Status:** Beta; independent review BLOCKED; physical-device gates NOT RUN.
> **Depends on:** [product-spec.md](product-spec.md), [legacy-v1-compatibility.md](legacy-v1-compatibility.md)

# Chat NoControl user guide

## Before you start

Use canonical site <https://levi-cm.github.io/chat-nocontrol/>. It has no
account or server recovery. Target version `0.2.0-beta.1` is not independently
reviewed. Avoid high-risk secrets until release gates pass.

## Create or restore identity

1. Choose a pseudonym and vault password, or select session-only mode.
2. Save recovery PDF/file/code/24 words and recovery QR. If offered, encrypted
   PPXV vault QR is a separate password-protected private backup.
3. Treat every recovery form as a private key. Vault password does not protect
   recovery file, code, words, PDF, or QR.
4. Complete restore check; then activate identity.

Import accepts current V2 recovery/vault material and legacy V1 PPXR, PPXV, or
recovery words. Legacy private material is migrated to V2. You do not need the
old app. Share your new V2 contact again after migration.

## Exchange contacts

Export your V2 public contact as `.ppxcontact` file or `PPX2:CONTACT:` text.
Import the other person's file/text and compare fingerprint through a separate
trusted channel.

There is no V2 contact QR creation or scanning workflow. A V1 contact cannot be
saved. If a legacy PPXQ needs it, provide that exact V1 contact only for the
unlocked identity session. The app never saves it, may reuse it for more legacy
messages during that session, and clears it on lock, identity change, erase-all,
reload, tab close, or session end.

## Encrypt text

1. Select saved V2 recipient.
2. Enter up to 256 KiB UTF-8.
3. Choose link and/or PPXT text output.
4. Send through an existing channel.

Full PPXT includes sender contact. Shorter PPXM link requires recipient already
saved your exact V2 contact. V2 message links use `#/m/`. No V2 message QR is
created.

## Encrypt file

Select one file up to 100 MiB and optional caption. Cancel discards operation;
restart from beginning. Send resulting `.ppxfile`.

## Decrypt

Paste armor/link/text or choose a file. App routes exact format/version/suite.
Supported legacy inputs:

- V1 PPXT format 1 or legacy compressed format 2;
- V1 PPXF, download-only after decrypt;
- V1 `#/m/<BASE64URL>` links carrying PPXT or PPXQ;
- V1 PPXQ text and old `#/decrypt/qr/...` links with exact sender contact;
- V1 recovery/vault import for V2 migration.

Legacy sender contacts are never added to contacts. No V1 output is created.
Malformed, wrong-recipient, damaged, downgrade, and mixed-suite input fails
closed.

## Offline and updates

After one successful load, app shell can work offline. Updates activate
silently: no banner or choice. A same-version page stays open; an older page may
navigate once automatically into CAT5. Supported incoming message fragments
remain local, are captured in memory, and are immediately removed from the URL
and history.

## Limits

No groups, delivery, history, sync, forward secrecy, ratchet, anonymity, or
secure-deletion guarantee. Device/browser compromise can expose secrets.
Independent review remains BLOCKED and real-device evidence NOT RUN until
published evidence says otherwise.

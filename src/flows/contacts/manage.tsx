import { useMemo, useRef, useState } from "preact/hooks";
import type { ContactSaveMutation } from "../../app/contact-save-queue";
import {
  ContactManagementCard,
  displayIdentityId,
  type ManagedContact,
} from "../../components/cards/contact-management-card";
import { TextField } from "../../components/forms/text-field";
import { PasteButton } from "../../components/forms/paste-button";
import { ConfirmationDialog } from "../../components/dialogs/confirmation";
import type { MessageKey } from "../../i18n";
import {
  encodePublicContactV2Text,
  parsePublicContactV2Text,
  PPXC_V2_MAXIMUM_BASE45_CHARS,
  PPXC_V2_TEXT_PREFIX,
} from "../../protocol/ppxc-v2";

function fingerprintId(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ContactsManage({
  t,
  contacts,
  onChange,
  readContactFileText = (file) => file.text(),
}: {
  t: (key: MessageKey) => string;
  contacts: ManagedContact[];
  onChange: (mutation: ContactSaveMutation) => Promise<boolean> | boolean;
  readContactFileText?: (file: File) => Promise<string>;
}) {
  const [payload, setPayload] = useState("");
  const [nickname, setNickname] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [selectedContactFile, setSelectedContactFile] = useState("");
  const importGeneration = useRef(0);
  const pendingDeleteContact = pendingDelete
    ? contacts.find(
        (candidate) =>
          fingerprintId(candidate.contact.fingerprint) === pendingDelete,
      )
    : undefined;

  const acceptPayload = (value: string, selectedFile = "") => {
    importGeneration.current += 1;
    setReadingFile(false);
    setPayload(value);
    setSelectedContactFile(selectedFile);
    setError("");
    setStatus("");
  };

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter(({ contact, nickname: localNickname }) =>
      `${contact.pseudonym} ${localNickname} ${fingerprintId(contact.fingerprint)}`
        .toLowerCase()
        .includes(query),
    );
  }, [contacts, search]);

  const save = async () => {
    if (busy) return;
    importGeneration.current += 1;
    setReadingFile(false);
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const contact = parsePublicContactV2Text(payload.trim());
      const id = fingerprintId(contact.fingerprint);
      const existingIndex = contacts.findIndex(
        (item) => fingerprintId(item.contact.fingerprint) === id,
      );
      if (existingIndex >= 0) {
        if (
          !(await onChange({
            kind: "update",
            fingerprint: contact.fingerprint,
            patch: {
              ...(nickname ? { nickname } : {}),
            },
          }))
        )
          throw new Error("storage write failed");
        setStatus(t("mergeNote"));
      } else {
        const collision = contacts.some(
          (item) => item.contact.pseudonym === contact.pseudonym,
        );
        if (
          !(await onChange({
            kind: "add",
            item: { contact, nickname, includeSenderContactInLinks: true },
          }))
        )
          throw new Error("storage write failed");
        if (collision) {
          setStatus(`${t("collisionWarning")}. ${t("collisionNote")}`);
        }
      }
      setPayload("");
      setSelectedContactFile("");
      setNickname("");
    } catch {
      setError(t("invalidContact"));
    } finally {
      setBusy(false);
    }
  };

  const importContactFile = async (file: File | undefined) => {
    const generation = importGeneration.current + 1;
    importGeneration.current = generation;
    if (!file) {
      setSelectedContactFile("");
      setReadingFile(false);
      return;
    }
    setError("");
    setStatus("");
    setReadingFile(true);
    try {
      if (
        file.size >
        PPXC_V2_TEXT_PREFIX.length + PPXC_V2_MAXIMUM_BASE45_CHARS
      ) {
        throw new Error("oversize contact");
      }
      const contact = parsePublicContactV2Text(
        (await readContactFileText(file)).trim(),
      );
      if (importGeneration.current !== generation) return;
      setPayload(encodePublicContactV2Text(contact));
      setSelectedContactFile(file.name);
    } catch {
      if (importGeneration.current === generation) {
        setError(t("invalidContact"));
        setSelectedContactFile("");
      }
    } finally {
      if (importGeneration.current === generation) setReadingFile(false);
    }
  };

  return (
    <section class="contacts-workspace">
      <div
        class="flow-panel contact-import-panel"
        data-testid="contact-import-drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const droppedFile = event.dataTransfer?.files.item(0) ?? null;
          if (droppedFile) {
            void importContactFile(droppedFile);
            return;
          }
          const droppedText = event.dataTransfer?.getData("text/plain") ?? "";
          if (droppedText.trim() !== "") acceptPayload(droppedText);
        }}
      >
        <h1>{t("contactsTitle")}</h1>
        <div class="field">
          <div class="field-heading">
            <label for="contact-payload">{t("contactPayload")}</label>
            <PasteButton
              label={t("paste")}
              unavailableLabel={t("pasteUnavailable")}
              failureLabel={t("pasteFailed")}
              disabled={busy || readingFile}
              onPaste={acceptPayload}
              onError={setError}
            />
          </div>
          <textarea
            class="field-control"
            id="contact-payload"
            rows={5}
            value={payload}
            onInput={(event) => acceptPayload(event.currentTarget.value)}
          />
        </div>
        {selectedContactFile && (
          <p class="input-meta">
            {t("selectedFile")}: {selectedContactFile}
          </p>
        )}
        <TextField
          id="contact-nickname"
          label={t("nickname")}
          value={nickname}
          onInput={setNickname}
        />
        <div class="field">
          <label for="contact-file">{t("contactFile")}</label>
          <input
            id="contact-file"
            type="file"
            accept=".ppxcontact,application/x-ppx-contact,text/plain"
            onChange={(event) =>
              void importContactFile(event.currentTarget.files?.[0])
            }
          />
        </div>
        <button
          class="button primary"
          type="button"
          disabled={busy || readingFile || payload.trim() === ""}
          onClick={() => void save()}
        >
          {t("saveContact")}
        </button>
        {status && (
          <p class="status-note" role="status">
            {status}
          </p>
        )}
        {error && (
          <p class="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div class="contact-list-panel">
        <TextField
          id="contact-search"
          label={t("contactsTitle")}
          placeholder={t("searchContacts")}
          value={search}
          onInput={setSearch}
        />
        {visible.length === 0 ? (
          <p class="empty-state">{t("contactsEmpty")}</p>
        ) : (
          <div class="contact-list">
            {visible.map((item) => {
              const id = fingerprintId(item.contact.fingerprint);
              return (
                <ContactManagementCard
                  key={id}
                  item={item}
                  t={t}
                  onDelete={() => setPendingDelete(id)}
                />
              );
            })}
          </div>
        )}
      </div>
      {pendingDelete && (
        <ConfirmationDialog
          t={t}
          title={t("deleteContactTitle")}
          body={
            pendingDeleteContact
              ? `${t("deleteContactConfirm")} ${t("shortIdentityId")}: ${displayIdentityId(pendingDeleteContact.contact.identityId)}`
              : t("deleteContactConfirm")
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (busy) return;
            if (!pendingDeleteContact) {
              setPendingDelete(null);
              return;
            }
            setBusy(true);
            void Promise.resolve(
              onChange({
                kind: "remove",
                fingerprint: pendingDeleteContact.contact.fingerprint,
              }),
            )
              .then((deleted) => {
                if (deleted) setPendingDelete(null);
              })
              .finally(() => setBusy(false));
          }}
        />
      )}
    </section>
  );
}

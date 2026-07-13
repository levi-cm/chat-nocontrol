import type { MessageKey } from "../../i18n";
import type { PublicContact } from "../../protocol/types";
import { formatFingerprintBytes } from "./public-contact-card";

export interface ManagedContact {
  contact: PublicContact;
  nickname: string;
}

export function displayIdentityId(identityId: Uint8Array): string {
  if (identityId.byteLength !== 20) throw new Error("invalid identity ID");
  return (
    [...identityId]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .match(/.{1,4}/gu)
      ?.join(" ") ?? ""
  );
}

export function ContactManagementCard({
  item,
  t,
  onDelete,
}: {
  item: ManagedContact;
  t: (key: MessageKey) => string;
  onDelete: () => void;
}) {
  return (
    <article class="contact-card">
      <div>
        <p class="contact-name">{item.nickname || item.contact.pseudonym}</p>
        {item.nickname && (
          <p class="contact-pseudonym">{item.contact.pseudonym}</p>
        )}
        <p class="contact-fingerprint">
          {t("shortIdentityId")}: {displayIdentityId(item.contact.identityId)}
        </p>
        <details>
          <summary>{t("fingerprint")}</summary>
          <code class="identity-id">
            {formatFingerprintBytes(item.contact.fingerprint, 32)}
          </code>
        </details>
      </div>
      <button
        class="button danger-button"
        type="button"
        aria-label={`${t("deleteContact")} ${item.nickname || item.contact.pseudonym}, ${t("shortIdentityId")} ${displayIdentityId(item.contact.identityId)}`}
        onClick={onDelete}
      >
        {t("deleteContact")}
      </button>
    </article>
  );
}

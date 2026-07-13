import type { MessageKey } from "../../i18n";
import type { PublicContact } from "../../protocol/types";
import {
  displayIdentityId,
  type ManagedContact,
} from "./contact-management-card";
import { formatFingerprintBytes } from "./public-contact-card";

function sameFingerprint(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index])
  );
}

export function AuthenticatedSenderCard({
  sender,
  contacts,
  t,
}: {
  sender: PublicContact;
  contacts: ManagedContact[];
  t: (key: MessageKey) => string;
}) {
  const known = contacts.find((item) =>
    sameFingerprint(item.contact.fingerprint, sender.fingerprint),
  );
  const name = known?.nickname
    ? `${known.nickname} (${sender.pseudonym})`
    : sender.pseudonym;
  return (
    <section class="authenticated-sender" aria-label={t("authenticatedSender")}>
      <h3>{t("authenticatedSender")}</h3>
      <dl>
        <div>
          <dt>{t("sender")}</dt>
          <dd>{name}</dd>
        </div>
        <div>
          <dt>{t("shortIdentityId")}</dt>
          <dd>
            <code class="identity-id">
              {displayIdentityId(sender.identityId)}
            </code>
          </dd>
        </div>
        <div>
          <dt>{t("contactStatus")}</dt>
          <dd>{known ? t("knownSender") : t("unknownSender")}</dd>
        </div>
      </dl>
      <details>
        <summary>{t("fingerprint")}</summary>
        <code class="identity-id">
          {formatFingerprintBytes(sender.fingerprint, 32)}
        </code>
      </details>
      <p class="input-meta">{t("verifySenderGuidance")}</p>
    </section>
  );
}

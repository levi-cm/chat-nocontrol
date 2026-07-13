import type { ManagedContact } from "../../components/cards/contact-management-card";

function fingerprintId(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isKnownSender(
  senderFingerprint: Uint8Array,
  contacts: ManagedContact[],
): boolean {
  const senderId = fingerprintId(senderFingerprint);
  return contacts.some(
    (item) => fingerprintId(item.contact.fingerprint) === senderId,
  );
}

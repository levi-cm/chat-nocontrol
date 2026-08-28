import {
  MESSAGE_LINK_V2_HASH_PREFIX,
  parseMessageLinkHashV2,
  type MessageLinkObjectV2,
} from "../protocol/message-link-v2";
import { PPXError } from "../protocol/types";

export function parseIncomingMessageText(
  text: string,
): MessageLinkObjectV2 | null {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!url.hash.startsWith(MESSAGE_LINK_V2_HASH_PREFIX)) return null;
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== ""
  ) {
    throw new PPXError("noncanonical-text");
  }
  return parseMessageLinkHashV2(url.hash);
}

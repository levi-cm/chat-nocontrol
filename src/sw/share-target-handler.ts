import { zeroize } from "../crypto/zeroize";
import type { InMemoryShareTargetStore } from "./share-target-store";

function isFile(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.prototype.toString.call(value) === "[object File]" &&
    typeof value.arrayBuffer === "function"
  );
}

export async function handleIncomingShareTarget(
  request: Request,
  input: {
    clientId: string;
    scope: string;
    token: string;
    now: number;
    store: InMemoryShareTargetStore;
  },
): Promise<Response> {
  if (
    request.method !== "POST" ||
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("multipart/form-data;")
  ) {
    throw new Error("invalid-shared-artifact");
  }
  const form = await request.formData();
  if (
    [...form.keys()].some((key) => key !== "message") ||
    form.getAll("message").length !== 1
  ) {
    throw new Error("invalid-shared-artifact");
  }
  const file = form.get("message");
  if (!isFile(file)) throw new Error("invalid-shared-artifact");
  const payload = new Uint8Array(await file.arrayBuffer());
  try {
    input.store.put(
      {
        token: input.token,
        clientId: input.clientId,
        name: file.name,
        mediaType: file.type,
        bytes: payload,
      },
      input.now,
    );
    return Response.redirect(new URL("./#/decrypt", input.scope), 303);
  } finally {
    zeroize(payload);
  }
}

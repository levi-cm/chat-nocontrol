/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  precacheAndRoute,
  type PrecacheEntry,
} from "workbox-precaching";
import { zeroize } from "./crypto/zeroize";
import { handleIncomingShareTarget } from "./sw/share-target-handler";
import {
  InMemoryShareTargetStore,
  SHARED_ARTIFACT_TTL_MS,
} from "./sw/share-target-store";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

const pendingShares = new InMemoryShareTargetStore();
const shareTargetPath = new URL("./share-target", self.registration.scope)
  .pathname;

void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

function randomToken(): string {
  const random = crypto.getRandomValues(new Uint8Array(32));
  try {
    return [...random]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  } finally {
    zeroize(random);
  }
}

function expireLater(): void {
  setTimeout(() => pendingShares.expire(Date.now()), SHARED_ARTIFACT_TTL_MS);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "POST" ||
    url.origin !== self.location.origin ||
    url.pathname !== shareTargetPath
  ) {
    return;
  }
  const clientId = event.resultingClientId || event.clientId;
  event.respondWith(
    handleIncomingShareTarget(event.request, {
      clientId,
      scope: self.registration.scope,
      token: randomToken(),
      now: Date.now(),
      store: pendingShares,
    }).catch(() => new Response("Invalid shared text file", { status: 400 })),
  );
  event.waitUntil(Promise.resolve().then(expireLater));
});

self.addEventListener("message", (event) => {
  const source = event.source;
  if (!source || !("id" in source)) return;
  const data = event.data as { type?: unknown; token?: unknown } | null;
  pendingShares.expire(Date.now());
  if (data?.type === "ppx-shared-artifact-ready") {
    for (const message of pendingShares.messagesForClient(
      source.id,
      Date.now(),
    )) {
      try {
        source.postMessage(message);
      } finally {
        zeroize(message.bytes);
      }
    }
    return;
  }
  if (
    data?.type === "ppx-shared-artifact-ack" &&
    typeof data.token === "string"
  ) {
    pendingShares.acknowledge(data.token, source.id);
  }
});

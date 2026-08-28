import { zeroize } from "../crypto/zeroize";
import {
  isSharedArtifactMessage,
  type IncomingSharedArtifact,
  type SharedArtifactAckMessage,
  type SharedArtifactReadyMessage,
} from "./shared-artifact-contract";

export type { IncomingSharedArtifact } from "./shared-artifact-contract";

export interface IncomingSharedArtifactHandoff {
  dispose(): void;
}

export function createIncomingSharedArtifactHandoff(
  serviceWorker: ServiceWorkerContainer,
  onArtifact: (artifact: IncomingSharedArtifact) => void,
  now: () => number = Date.now,
): IncomingSharedArtifactHandoff {
  const postReady = () => {
    const message: SharedArtifactReadyMessage = {
      type: "ppx-shared-artifact-ready",
    };
    serviceWorker.controller?.postMessage(message);
  };
  const onMessage = (event: MessageEvent<unknown>) => {
    if (!isSharedArtifactMessage(event.data)) return;
    const retained = Uint8Array.from(event.data.bytes);
    try {
      onArtifact({
        name: event.data.name,
        mediaType: event.data.mediaType,
        bytes: retained,
        receivedAt: now(),
      });
      const acknowledgement: SharedArtifactAckMessage = {
        type: "ppx-shared-artifact-ack",
        token: event.data.token,
      };
      serviceWorker.controller?.postMessage(acknowledgement);
    } catch {
      zeroize(retained);
    }
  };
  serviceWorker.addEventListener("message", onMessage);
  serviceWorker.addEventListener("controllerchange", postReady);
  postReady();
  return {
    dispose() {
      serviceWorker.removeEventListener("message", onMessage);
      serviceWorker.removeEventListener("controllerchange", postReady);
    },
  };
}

import { describe, expect, it } from "vitest";
import type { PPXWorkerEvent, PPXWorkerRequest } from "../../crypto/contracts";

function routeRequest(request: PPXWorkerRequest): string {
  return `${request.kind}:${request.requestId}`;
}

function routeEvent(event: PPXWorkerEvent): string {
  return `${event.kind}:${event.requestId}`;
}

describe("authoritative worker contracts", () => {
  it("uses kind and requestId for request and event routing", () => {
    const request = {
      kind: "cancel",
      requestId: "job-1",
    } satisfies PPXWorkerRequest;
    const event = {
      kind: "cancelled",
      requestId: "job-1",
    } satisfies PPXWorkerEvent;
    expect(routeRequest(request)).toBe("cancel:job-1");
    expect(routeEvent(event)).toBe("cancelled:job-1");
  });
});

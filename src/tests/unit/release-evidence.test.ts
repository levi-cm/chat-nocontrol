import { describe, expect, it } from "vitest";

import {
  buildReleaseRecord,
  buildSbom,
  releaseArtifactName,
  serializeEvidence,
} from "../../../scripts/release-evidence";

describe("release evidence", () => {
  it("builds deterministic CycloneDX release evidence", () => {
    const lock = {
      name: "chat-nocontrol",
      version: "0.1.0-beta.1",
      packages: {
        "": {
          name: "chat-nocontrol",
          version: "0.1.0-beta.1",
          license: "AGPL-3.0-or-later",
        },
        "node_modules/preact": { version: "10.29.7", license: "MIT" },
        "node_modules/tool/node_modules/preact": {
          version: "10.0.0",
          license: "MIT",
        },
      },
    };

    const first = serializeEvidence(buildSbom(lock));
    const second = serializeEvidence(buildSbom(lock));

    expect(first).toBe(second);
    expect(JSON.parse(first)).toMatchObject({
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      metadata: {
        component: {
          type: "application",
          name: "chat-nocontrol",
          version: "0.1.0-beta.1",
          licenses: [{ license: { id: "AGPL-3.0-or-later" } }],
        },
      },
    });
    const parsed = JSON.parse(first) as { components: unknown[] };
    expect(parsed.components).toHaveLength(2);
  });

  it("records a beta artifact, SBOM, build log, and explicit initial rollback", () => {
    const artifactSha256 = "c".repeat(64);
    const sbomSha256 = "d".repeat(64);
    const testReportSha256 = "e".repeat(64);
    const record = buildReleaseRecord({
      packageName: "chat-nocontrol",
      version: "0.1.0-beta.1",
      commit: "a".repeat(40),
      tag: "v0.1.0-beta.1",
      artifactSha256,
      sbomSha256,
      testReportSha256,
      deploymentUrl: "https://levi-cm.github.io/chat-nocontrol/",
      remoteTagObjectId: "f".repeat(40),
      rollbackTag: null,
    });

    expect(releaseArtifactName("0.1.0-beta.1")).toBe(
      "chat-nocontrol-v0.1.0-beta.1.tgz",
    );
    expect(record).toMatchObject({
      schemaVersion: 1,
      channel: "beta",
      source: {
        commit: "a".repeat(40),
        tag: "v0.1.0-beta.1",
        remoteTagObjectId: "f".repeat(40),
      },
      artifact: { sha256: artifactSha256 },
      sbom: { sha256: sbomSha256 },
      testReport: { sha256: testReportSha256, status: "passed" },
      signatureVerification: { status: "verified" },
      deployment: {
        url: "https://levi-cm.github.io/chat-nocontrol/",
      },
      buildLog: "build.log",
      rollback: {
        tag: null,
        reason: "Initial release; no previous deployed tag exists.",
      },
    });
  });

  it("refuses to represent a stable release", () => {
    expect(() =>
      buildReleaseRecord({
        packageName: "chat-nocontrol",
        version: "1.0.0",
        commit: "b".repeat(40),
        tag: "v1.0.0",
        artifactSha256: "c".repeat(64),
        sbomSha256: "d".repeat(64),
        testReportSha256: "e".repeat(64),
        deploymentUrl: "https://levi-cm.github.io/chat-nocontrol/",
        remoteTagObjectId: null,
        rollbackTag: "v0.1.0-beta.1",
      }),
    ).toThrow("Stable release is unavailable");
  });
});
